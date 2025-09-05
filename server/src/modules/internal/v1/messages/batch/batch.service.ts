import type { FastifyRequest } from "fastify";
import type { BatchInput } from "./batch.schema.js";
import { processOutboundMessage } from "@/utils/processOutboundMessage.js";
import type { OutboundMessage } from "@messaging-service/types/outboundMessage.js";

export async function batchService(request: FastifyRequest, input: BatchInput) {
  const idempotencyKey = request.headers['idempotency-key'];
  const outboundMsg: OutboundMessage[] = [];

  if (!idempotencyKey || !Array.isArray(idempotencyKey))
    throw new Error('Idempotency key is required');

  for (let i = 0; i < input.length; i++) {
    const currentIdempotencyKey = idempotencyKey[i];
    if (typeof currentIdempotencyKey !== 'string')
      throw new Error('Idempotency key must be a string');

    const msgInput = input[i];
    if (!msgInput)
      throw new Error(`Input at index ${i} is invalid`);
    
    outboundMsg.push(await processOutboundMessage(request, currentIdempotencyKey, msgInput));
  }

  return { messageId: outboundMsg.map(msg => msg.id) };
}