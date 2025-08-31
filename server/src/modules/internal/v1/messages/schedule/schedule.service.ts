import type { FastifyRequest } from "fastify";
import type { ScheduleInput } from "./schedule.schema.js";

import type { Message, MessageStatus } from "@messaging-service/types";
import { getQueue } from "@messaging-service/utils";

export async function scheduleService(request: FastifyRequest, input: ScheduleInput) {
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

  return { messageId: outboundMsg.id };
}