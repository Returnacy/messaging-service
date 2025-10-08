import type { FastifyReply, FastifyRequest } from 'fastify';

import { messageSchema } from '@messaging-service/types';
import { messagesService } from './messages.service.js';

export async function messagesHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = messageSchema.parse(request.body);
    const res = await messagesService(request, input);
    return reply.status(202).send(res);
  } catch (error) {
    return reply.status(400).send(error);
  }
}