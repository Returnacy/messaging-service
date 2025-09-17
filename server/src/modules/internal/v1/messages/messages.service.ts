import type { FastifyRequest } from "fastify";
import type { MessagesInput } from "./messages.schema.js";
import type { Message, MessageStatus } from "@messaging-service/types";

import { processOutboundMessage } from "../../../../utils/processOutboundMessage.js";
import { getQueue } from "@messaging-service/utils";

export async function messagesService(request: FastifyRequest, input: MessagesInput) {
  const idempotencyKey = request.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string')
    throw new Error('Idempotency key is required');

  const outboundMsg = await processOutboundMessage(request, idempotencyKey, input);

  return { messageId: outboundMsg.id };
}