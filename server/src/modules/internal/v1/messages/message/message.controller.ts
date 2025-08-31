import type { FastifyReply, FastifyRequest } from 'fastify';

import { messageService } from './message.service.js';

export async function messageHandler(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
  try {
    const msg = await messageService(request);
    return reply.send(msg);
  } catch (error) {
    return reply.status(400).send(error);
  }
}