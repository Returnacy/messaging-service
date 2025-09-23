import type { FastifyRequest } from "fastify";
import type { Message } from "@messaging-service/types";

import { processOutboundMessage } from "../../../../utils/processOutboundMessage.js";

export async function messagesService(request: FastifyRequest, input: Message) {
  const idempotencyKey = request.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string')
    throw new Error('Idempotency key is required');

  const outboundMsg = await processOutboundMessage(request, idempotencyKey, input);

  return { messageId: outboundMsg.id };
}