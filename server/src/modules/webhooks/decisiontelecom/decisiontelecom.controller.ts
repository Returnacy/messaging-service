import type { FastifyReply, FastifyRequest } from 'fastify';

import { decisiontelecomReceiptSchema } from '@messaging-service/types';
import { decisionTelecomService } from './decisiontelecom.service.js';

export async function decisionTelecomHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = decisiontelecomReceiptSchema.parse(request.body);

    await decisionTelecomService(request, input);

    return reply.code(202).send({ accepted: true });
  } catch (error) {
    return reply.status(400).send(error);
  }
}