import type { FastifyRequest } from "fastify";
import type { DecisionTelecomReceiptInput } from "./decisiontelecom.schema.js";
import { getQueue } from "@messaging-service/utils";

export async function decisionTelecomService(request: FastifyRequest, input: DecisionTelecomReceiptInput) {
  const queue = getQueue('messages.updates', request.server.redisConnection);

  const translateToStatus = (status: number) => {
    switch (status) {
      case 1:
        return 'ENROUTE';
      case 2:
        return 'DELIVERED';
      case 3:
        return 'EXPIRED';
      case 4:
        return 'DELETED';
      case 5:
        return 'UNDELIVERABLE';
      case 6:
        return 'ACCEPTED';
      case 7:
        return 'UNKNOWN';
      case 8:
        return 'REJECTED';
      default:
        return 'UNKNOWN';
    }
  };

  const status = translateToStatus(input.status);

  queue.add('decisiontelecom', {
    providerMessageId: input.message_id,
    status: status,
    timestamp: Date.now(),
    raw: input,
  });
}