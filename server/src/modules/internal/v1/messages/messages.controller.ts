import type { FastifyReply, FastifyRequest } from 'fastify';

import { messagesSchema } from './messages.schema.js';
import { messagesService } from './messages.service.js';

export async function messagesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = messagesSchema.parse(request.body);

    const res = messagesService(request, input);
  } catch (error) {
    return reply.status(400).send(error);
  }
}