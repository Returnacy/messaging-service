import type { FastifyReply, FastifyRequest } from 'fastify';

import { sendSchema } from './send.schema.js';
import { sendService } from './send.service.js';

export async function sendHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = sendSchema.parse(request.body);

    const msg = sendService(request, input);
  } catch (error) {
    return reply.status(400).send(error);
  }
}