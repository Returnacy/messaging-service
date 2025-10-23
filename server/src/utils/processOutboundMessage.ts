import type { FastifyRequest } from 'fastify';
import type { Message, MessageStatus, OutboundMessage } from '@messaging-service/types';
import { getQueue } from "@messaging-service/utils";
import { computeMessageMinuteHash } from '@messaging-service/utils';

export async function processOutboundMessage(
  request: FastifyRequest,
  input: Message
): Promise<OutboundMessage> {
  const logger = (request as any).log ?? { info: (..._args: any[]) => {}, warn: (..._args: any[]) => {}, error: (..._args: any[]) => {} };
  const refDate = input.scheduledAt ?? new Date();
  // Prefer client-provided idempotencyKey to ensure stable dedup across retries/reruns
  const providedKey = (input as any).idempotencyKey && String((input as any).idempotencyKey).trim();
  const idempotencyKey: string = providedKey || computeMessageMinuteHash({
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
  if (existing) {
    logger.info({ id: existing.id, idempotencyKey, dedup: true }, 'message dedup hit, returning existing');
    return existing;
  }

  const msgWithKey = { ...input, idempotencyKey } as any;

  const outboundMsg: OutboundMessage = await request.server.repository.createOutboundMessage(msgWithKey);
  logger.info({ id: outboundMsg.id, idempotencyKey }, 'message persisted');

  if (outboundMsg.status === 'QUEUED' as MessageStatus) {
    const queue = getQueue('messages.dispatch', request.server.redisConnection);
    queue.add('dispatch', outboundMsg);
    logger.info({ id: outboundMsg.id }, 'message enqueued for dispatch');
  }

  return outboundMsg;
}