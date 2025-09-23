import type { FastifyReply, FastifyRequest } from 'fastify';

import { batchSchema } from '@messaging-service/types';
import { batchService } from './batch.service.js';

export async function batchHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = batchSchema.parse(request.body);

    const msg = await batchService(request, input);
  } catch (error) {
    return reply.status(400).send(error);
  }
}