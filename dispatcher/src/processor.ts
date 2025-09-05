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

      await this.repo.createProviderRequestLog({ outboundMessageId: msg.id, providerId: msg.providerId || 'unknown', request: msg.payload, response: res, httpStatus: 200 });
      await this.repo.updateOutboundMessageStatusToSent(msg.id);
      
      return { success: true, providerId: res.providerId };
    } catch (err: any) {
      const isTransient = Processor.isTransientError(err);
      const attempt = msg.attempt + 1;
      const finalFailure = attempt >= msg.maxAttempts;

      await this.repo.createProviderRequestLog({ outboundMessageId: msg.id, providerId: msg.providerId || 'unknown', request: msg.payload, response: null, httpStatus: err.message || String(err) });
      await this.repo.updateOutboundMessageOnFailure(msg.id, attempt, err.message || String(err), finalFailure);
      
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
}