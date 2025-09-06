import type { FastifyRequest } from "fastify";
import type { ResendReceiptInput } from "./resend.schema.js";
import { getQueue } from "@messaging-service/utils";

export async function resendService(request: FastifyRequest, input: ResendReceiptInput) {
  const queue = getQueue('messages.updates', request.server.redisConnection);

  const translateToStatus = (status: string) => {
    switch (status) {
      case 'email.sent':
        return 'SENT';
      case 'email.delivered':
        return 'DELIVERED';
      case 'email.bounced':
        return 'BOUNCED';
      default:
        return 'UNKNOWN';
    }
  };

  const status = translateToStatus(input.type);

  queue.add('decisiontelecom', {
    providerMessageId: input.data.email_id,
    status: status,
    timestamp: Date.now(),
    raw: input,
  });
}