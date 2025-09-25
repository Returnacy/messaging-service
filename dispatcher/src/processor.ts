import { RepositoryPrisma } from '@messaging-service/db';
import { sendWithResendAdapter } from './adapters/resend.js';
import { sendWithDecisionTelecomAdapter } from './adapters/decisionTelecom.js';
import type { OutboundMessage } from '@messaging-service/types';
import { ProviderRateLimiter } from './providerRateLimiter.js';
import type { ProviderResponse } from './adapters/types/providerResponse.js';

export class Processor {
  private repo: RepositoryPrisma;
  private limiter: ProviderRateLimiter;
  private readonly logger?: { info?: (...args: any[]) => void; warn?: (...args: any[]) => void; error?: (...args: any[]) => void };

  constructor(repo: RepositoryPrisma, redisClient: any, opts?: { limiterOptions?: any; logger?: any }) {
    if (!repo) throw new Error('Processor requires a repo instance');
    if (!redisClient) throw new Error('Processor requires a Redis client for the rate limiter');
    this.repo = repo;
    this.limiter = new ProviderRateLimiter(redisClient, opts?.limiterOptions);
    this.logger = opts?.logger;
  }

  async processJob(msg: OutboundMessage) {
    if (!msg) throw new Error('OutboundMessage not found');

    if (msg.status !== 'QUEUED') {
      this.logger?.info?.('Skipping not-queued message', msg.id, msg.status);
      return { skipped: true, reason: 'status-not-queued' };
    }

    msg = await this.repo.updateOutboundMessageStatusToSending(msg.id);

    try {
      const rateLimitKey = (msg.providerId && String(msg.providerId)) || (msg.channel && String(msg.channel));
      if (!rateLimitKey) throw new Error('Unable to determine rate limit key (missing providerId and channel)');

      await this.limiter.consume(rateLimitKey);

      let res: ProviderResponse;
      switch (msg.channel) {
        case 'EMAIL':
          res = await sendWithResendAdapter(msg) as ProviderResponse;
          break;
        case 'SMS':
          res = await sendWithDecisionTelecomAdapter(msg) as ProviderResponse;
          break;
        default:
          throw new Error(`Unsupported channel: ${msg.channel}`);
      }

      const providerId = res?.providerId ?? (msg as any).providerId ?? 'unknown';
      const providerMessageId = res?.providerMessageId ?? null;

      await this.repo.createProviderRequestLog({ outboundMessageId: res.outboundMessageId ?? msg.id, providerId, request: res.requestPayload ?? {}, response: res.responsePayload ?? {}, httpStatus: res.httpStatus ?? null });

      await this.repo.updateOutboundMessageStatusToSent(msg.id);
      if (providerMessageId) {
        await this.repo.updateOutboundMessageExternalId(msg.id, providerMessageId);
      }

      this.logger?.info?.('Message sent', msg.id, 'provider', providerId);

      return { success: true, providerId };
    } catch (err: any) {
      const isTransient = Processor.isTransientError(err);
      const attempt = (msg.attempt ?? 0) + 1;
      const finalFailure = attempt >= (msg.maxAttempts ?? 5);
      const errMessage = err?.message ?? String(err ?? 'unknown error');

      try {
        await this.repo.updateOutboundMessageStatusOnFailure(msg.id, attempt, errMessage, finalFailure);
      } catch (dbErr) {
        this.logger?.error?.('Failed to update message failure status for', msg.id, dbErr);
      }

      if (isTransient && !finalFailure) {
        this.logger?.warn?.('Transient error, will retry', { id: msg.id, err: errMessage });
        throw err;
      }

      this.logger?.error?.('Permanent or final failure for message', msg.id, errMessage);
      return { failed: true, finalFailure };
    }
  }

  static isTransientError(err: any) {
    if (!err) return false;
    if (typeof err === 'object') {
      if ((err as any).code && ((err as any).code === 'ETIMEDOUT' || (err as any).code === 'ECONNRESET')) return true;
      if (typeof (err as any).status === 'number') {
        if ((err as any).status === 429) return true;
        if ((err as any).status >= 500 && (err as any).status < 600) return true;
      }
      if ((err as any).response?.status === 429) return true;
      if ((err as any).response?.status >= 500 && (err as any).response?.status < 600) return true;
    }
    const msg = String((err as any).message ?? err ?? '').toLowerCase();
    if (!msg) return false;
    if (msg.includes('etimedout') || msg.includes('econnreset')) return true;
    if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('429')) return true;
    if (/\b5\d{2}\b/.test(msg)) return true;
    return false;
  }

  async processDeliveryReceipt(payload: {
    provider: string;
    eventType: string;
    status: string;
    timestamp?: string | number | Date;
    raw: any;
    providerMessageId: string;
  }) {
    if (!payload || !payload.providerMessageId) throw new Error('Invalid update payload: missing providerMessageId');
    const msg = await this.repo.getOutboundMessageByExternalId(payload.providerMessageId);
    if (!msg) throw new Error('OutboundMessage not found for providerMessageId: ' + payload.providerMessageId);
    const timestamp = payload.timestamp ? new Date(payload.timestamp as any) : new Date();
    await this.repo.createDeliveryReceipt({
      outboundMessageId: msg.id,
      provider: msg.provider?.id ?? payload.provider,
      eventType: 'ProviderMessageUpdate',
      status: payload.status,
      timestamp,
      raw: payload.raw ?? {},
      providerMessageId: payload.providerMessageId,
    });
    const normalized = (payload.status || payload.eventType || '').toLowerCase();
    if (['delivered', 'success', 'sent'].includes(normalized)) {
      await this.repo.updateOutboundMessageStatusToDelivered(msg.id);
      return { updated: true, status: 'DELIVERED' };
    }
    if (['bounce', 'bounced'].includes(normalized)) {
      await this.repo.updateOutboundMessageStatusToBounced(msg.id);
      return { updated: true, status: 'BOUNCED' };
    }
    if (['failed', 'undeliverable', 'error'].includes(normalized)) {
      await this.repo.updateOutboundMessageStatusToFailed(msg.id);
      return { updated: true, status: 'FAILED' };
    }
    return { updated: false, reason: 'unknown-status', normalized };
  }
}