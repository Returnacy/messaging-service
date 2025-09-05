import type { FastifyRequest } from "fastify";
import type { SendInput } from "./send.schema.js";

import { processOutboundMessage } from "@/utils/processOutboundMessage.js";

export async function sendService(request: FastifyRequest, input: SendInput) {
  const idempotencyKey = request.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string')
    throw new Error('Idempotency key is required');

  const outboundMsg = await processOutboundMessage(request, idempotencyKey, input);

  return { messageId: outboundMsg.id };
}