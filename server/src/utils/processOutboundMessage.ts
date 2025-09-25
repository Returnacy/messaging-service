import type { FastifyRequest } from 'fastify';
import type { Message, MessageStatus, OutboundMessage } from '@messaging-service/types';
import { getQueue } from "@messaging-service/utils";
import { computeMessageMinuteHash } from '@messaging-service/utils';

export async function processOutboundMessage(
  request: FastifyRequest,
  input: Message
): Promise<OutboundMessage> {
  const refDate = input.scheduledAt ?? new Date();
  const idempotencyKey: string = computeMessageMinuteHash({
    recipientId: input.recipientId,
    channel: input.channel,
    payload: {
      subject: input.payload.subject,
      bodyHtml: input.payload.bodyHtml,
      bodyText: input.payload.bodyText,
      from: input.payload.from,
      to: input.payload.to,
    },
    campaignId: input.campaignId ?? null,
  }, refDate);

  // Fast path: if a message with this key already exists, return it
  const existing = await request.server.repository.getOutboundMessageByIdempotencyKey(idempotencyKey);
  if (existing) return existing;

  const msgWithKey = { ...input, idempotencyKey } as any;

  const outboundMsg: OutboundMessage = await request.server.repository.createOutboundMessage(msgWithKey);

  if (outboundMsg.status === 'QUEUED' as MessageStatus) {
    const queue = getQueue('messages.dispatch', request.server.redisConnection);
    queue.add('dispatch', outboundMsg);
  }

  return outboundMsg;
}