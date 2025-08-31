import type { FastifyRequest } from "fastify";
import type { SendInput } from "./send.schema.js";

import type { Message, MessageStatus } from "@messaging-service/types";
import { getQueue } from "@messaging-service/utils";

export async function sendService(request: FastifyRequest, input: SendInput) {
  const idempotencyKey = request.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string')
    throw new Error('Idempotency key is required');

  const external = await request.server.repository.createIdempotencyKey(idempotencyKey);

  if (!external)
    throw new Error('Failed to create idempotency key');

  const msg: Message = {
    ...input,
    externalId: external.key,
  };

  const outboundMsg = await request.server.repository.createOutboundMessage(msg);

  if (outboundMsg.status === 'QUEUED' as MessageStatus) {
    const queue = getQueue('messages.dispatch', request.server.redisConnection);
    /* await */ queue.add('dispatch', outboundMsg);
  }

  return { messageId: outboundMsg.id };
}