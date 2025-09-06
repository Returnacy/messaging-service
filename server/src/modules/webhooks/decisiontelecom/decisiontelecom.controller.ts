import type { FastifyReply, FastifyRequest } from 'fastify';

import { decisionTelecomReceiptSchema } from './decisiontelecom.schema.js';
import { decisionTelecomService } from './decisiontelecom.service.js';

export async function decisionTelecomHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = decisionTelecomReceiptSchema.parse(request.body);

    await decisionTelecomService(request, input);

    return reply.code(202).send({ accepted: true });
  } catch (error) {
    return reply.status(400).send(error);
  }
}