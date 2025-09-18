import type { FastifyRequest } from 'fastify';
import type { MessagesInput } from '../modules/internal/v1/messages/messages.schema.js';
import type { Message, MessageStatus, OutboundMessage } from '@messaging-service/types';
import { getQueue } from "@messaging-service/utils";

export async function processOutboundMessage(
  request: FastifyRequest,
  idempotencyKey: string,
  input: MessagesInput
): Promise<OutboundMessage> {
  const external = await request.server.repository.createIdempotencyKey(idempotencyKey);

  if (!external)
    throw new Error('Failed to create idempotency key');

  const msg: Message = {
    ...input,
    externalId: external.key,
  };

  const outboundMsg: OutboundMessage = await request.server.repository.createOutboundMessage(msg);

  if (outboundMsg.status === 'QUEUED' as MessageStatus) {
    const queue = getQueue('messages.dispatch', request.server.redisConnection);
    queue.add('dispatch', outboundMsg);
  }

  return outboundMsg;
}