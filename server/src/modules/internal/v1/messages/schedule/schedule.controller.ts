import type { FastifyReply, FastifyRequest } from 'fastify';

import { scheduleSchema } from './schedule.schema.js';
import { scheduleService } from './schedule.service.js';

export async function scheduleHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = scheduleSchema.parse(request.body);

    const msg = scheduleService(request, input);
  } catch (error) {
    return reply.status(400).send(error);
  }
}