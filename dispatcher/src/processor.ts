import { RepositoryPrisma } from "@messaging-service/db";
import { sendWithResendAdapter } from "./adapters/resend.js";
import { sendWithDecisionTelecomAdapter } from "./adapters/decisionTelecom.js";
import type { OutboundMessage } from "@messaging-service/types";

export class Processor {
  repo: RepositoryPrisma;

  constructor(repo: RepositoryPrisma) {
    this.repo = repo;
  }

  async processJob(msg: OutboundMessage) {
    if (!msg)
      throw new Error(`OutboundMessage not found`);

    if (msg.status !== 'QUEUED') {
      // Nothing to do
      return { skipped: true, reason: 'status-not-queued' };
    }

    // Mark Sending
    msg = await this.repo.updateOutboundMessageStatusToSending(msg.id);

    // Choose adapter
    try {
      let res: any;

      switch (msg.channel) {
        case 'EMAIL':
          res = await sendWithResendAdapter(msg);
          break;
        case 'SMS':
          res = await sendWithDecisionTelecomAdapter(msg);
          break;
        default:
          throw new Error(`Unsupported channel: ${msg.channel}`);
      }

      await this.repo.createProviderRequestLog({ outboundMessageId: res.outboundMessageId, providerId: res.providerId, request: res.requestPayload, response: res.responsePayload, httpStatus: res.httpStatus });
      await this.repo.updateOutboundMessageStatusToSent(msg.id);
      msg = await this.repo.updateOutboundMessageExternalId(msg.id, res.providerMessageId);

      return { success: true, providerId: msg.providerId };
    } catch (err: any) {
      const isTransient = Processor.isTransientError(err);
      const attempt = msg.attempt + 1;
      const finalFailure = attempt >= msg.maxAttempts;

      await this.repo.updateOutboundMessageStatusOnFailure(msg.id, attempt, err.message || String(err), finalFailure);
      
      if (isTransient && !finalFailure) {
        // throw to let BullMQ retry (job attempts configured there)
        throw err;
      }
      // permanent or final failure: swallow so job won't retry
      return { failed: true, finalFailure };
    }
  }

  static isTransientError(err: any) {
    // crude detection: network / 5xx / rate-limit
    if (!err)
      return false;
    const msg = String(err.message || err);
    
    if (msg.includes('ETIMEDOUT') || msg.includes('ECONNRESET'))
      return true;
    if (msg.includes('rate limit') || msg.includes('429'))
      return true;
    if (/5\d{2}/.test(msg))
      return true;

    return false;
  }

  /**
   * Handle provider callback/update jobs enqueued by server webhooks
   * Payload shape is intentionally generic to support multiple providers
   */
  async processDeliveryReceipt(payload: {
    provider: string;
    eventType: string;
    status: string;
    timestamp?: string | number | Date;
    raw: any;
    providerMessageId: string;
  }) {
    if (!payload || !payload.providerMessageId) {
      throw new Error('Invalid update payload: missing providerMessageId');
    }

    const msg = await this.repo.getOutboundMessageByExternalId(payload.providerMessageId);
    if (!msg) {
      throw new Error('OutboundMessage not found for providerMessageId: ' + payload.providerMessageId);
    }

    // Store receipt
    await this.repo.createDeliveryReceipt({
      outboundMessageId: msg.id,
      provider: msg.provider.id,
      eventType: "ProviderMessageUpdate",
      status: payload.status,
      timestamp: payload.timestamp as Date || new Date(),
      raw: payload.raw ?? {},
      providerMessageId: payload.providerMessageId ?? null,
    });

    // Map provider status/event to MessageStatus
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

    // Unknown: keep as is, but record receipt
    return { updated: false, reason: 'unknown-status', normalized };
  }
}