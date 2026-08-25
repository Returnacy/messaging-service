import { RepositoryPrisma } from '@messaging-service/db';
import { sendWithResendAdapter } from './adapters/resend.js';
import { sendWithDecisionTelecomAdapter } from './adapters/decisionTelecom.js';
import type { OutboundMessage } from '@messaging-service/types';
import { ProviderRateLimiter } from './providerRateLimiter.js';
import type { ProviderResponse } from './adapters/types/providerResponse.js';
import { createEvent, EventTypes } from '@returnacy/event-contracts';

/**
 * Hard stop on outbound sends.
 *
 * A newly provisioned tenant must not be able to email or SMS anyone by
 * accident, and "we just won't set the API keys" is not a control — it is an
 * omission that a later copy-paste of env vars silently undoes. With
 * MESSAGING_DRY_RUN=true the dispatcher walks the whole pipeline (status
 * transitions, provider request log, events) but never calls a provider.
 *
 * Read per call rather than cached at import so it can be flipped without a
 * rebuild, and so tests can toggle it.
 */
export function isDryRun(): boolean {
  const flag = String(process.env.MESSAGING_DRY_RUN ?? '').toLowerCase().trim();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

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
      if (isDryRun()) {
        // Validate the channel exactly as a real send would, so a dry run still
        // surfaces a misconfigured message instead of quietly "succeeding".
        if (msg.channel !== 'EMAIL' && msg.channel !== 'SMS') {
          throw new Error(`Unsupported channel: ${msg.channel}`);
        }
        this.logger?.warn?.(
          'MESSAGING_DRY_RUN: not sending', msg.id, 'channel', msg.channel, 'to', (msg as any).to ?? (msg as any).recipient ?? null,
        );
        res = {
          outboundMessageId: msg.id,
          providerId: msg.providerId ?? (msg.channel === 'EMAIL' ? 'resend' : 'decisiontelecom'),
          providerMessageId: null,
          httpStatus: null,
          requestPayload: { dryRun: true },
          responsePayload: { dryRun: true },
        } as unknown as ProviderResponse;
      } else {
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
      }

      const providerId = res?.providerId ?? msg.providerId ?? 'unknown';
      const providerMessageId = res?.providerMessageId ?? null;

      await this.repo.createProviderRequestLog({ outboundMessageId: res.outboundMessageId ?? msg.id, providerId, request: res.requestPayload ?? {}, response: res.responsePayload ?? {}, httpStatus: res.httpStatus ?? null });

      await this.repo.updateOutboundMessageStatusToSent(msg.id);
      if (providerMessageId) {
        await this.repo.updateOutboundMessageExternalId(msg.id, providerMessageId);
      }

      this.logger?.info?.('Message sent', msg.id, 'provider', providerId);

      // Emit message.sent event (outbox pattern)
      try {
        const evt = createEvent({
          type: EventTypes.MESSAGE_SENT,
          version: 1,
          producer: 'messaging-service.dispatcher',
          payload: {
            messageId: msg.id,
            provider: providerId,
            channel: msg.channel,
            status: 'SENT',
            externalReference: providerMessageId || undefined,
            sentAt: new Date().toISOString(),
            businessId: (msg as any)?.payload?.metadata?.businessId || undefined,
            campaignId: msg.campaignId || undefined
          },
          traceId: (globalThis as any).process?.env?.TRACE_ID || undefined
        });
        await (this.repo as any).createOutboxEvent({
          aggregateType: 'OutboundMessage',
          aggregateId: msg.id,
          type: evt.type,
          version: evt.version,
          payload: evt,
          traceId: evt.traceId
        });
      } catch (evtErr) {
        this.logger?.error?.('Failed to enqueue message.sent event', { id: msg.id, error: (evtErr as Error).message });
      }

      return { success: true, providerId };
    } catch (err: any) {
      const isTransient = Processor.isTransientError(err);
      const attempt = (msg.attempt ?? 0) + 1;
      const finalFailure = attempt >= (msg.maxAttempts ?? 5);
      const errMessage = err?.message ?? String(err ?? 'unknown error');

      try {
        const updated = await this.repo.updateOutboundMessageStatusOnFailure(msg.id, attempt, errMessage, finalFailure);
        if (!updated) {
          this.logger?.info?.('Failure update skipped due to terminal state', { id: msg.id, err: errMessage });
        }
      } catch (dbErr) {
        this.logger?.error?.('Failed to update message failure status for', msg.id, dbErr);
      }

      // Record provider error details for observability and easier diagnostics
      try {
        const httpStatus: number | null = (err?.status ?? err?.statusCode ?? err?.response?.status) ?? null;
        const providerId = (msg.providerId as any) || (msg.channel === 'EMAIL' ? 'resend' : (msg.channel ? String(msg.channel).toLowerCase() : 'unknown'));
        // Best-effort request snapshot
        const requestPayload: any = (() => {
          try {
            if (msg.channel === 'EMAIL') {
              return {
                from: (msg as any)?.payload?.from,
                to: [(msg as any)?.payload?.to?.email].filter(Boolean),
                subject: (msg as any)?.payload?.subject,
              };
            }
            if (msg.channel === 'SMS') {
              return {
                to: (msg as any)?.payload?.to?.phone,
                text: (msg as any)?.payload?.bodyText,
              };
            }
          } catch (_) { /* noop */ }
          return {};
        })();
        const responsePayload: any = {
          error: errMessage,
          code: err?.code ?? undefined,
          details: (err && typeof err === 'object') ? (err.response?.data ?? undefined) : undefined,
        };
        await this.repo.createProviderRequestLog({
          outboundMessageId: msg.id,
          providerId,
          request: requestPayload,
          response: responsePayload,
          httpStatus: (httpStatus ?? 0),
        });
      } catch (logErr) {
        this.logger?.error?.('Failed to log provider error for message', msg.id, (logErr as Error).message);
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