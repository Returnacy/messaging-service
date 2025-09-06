import type { FastifyReply, FastifyRequest } from 'fastify';

import { resendReceiptSchema } from './resend.schema.js';
import { resendService } from './resend.service.js';

export async function resendHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const input = resendReceiptSchema.parse(request.body);

    await resendService(request, input);

    return reply.code(202).send({ accepted: true });
  } catch (error) {
    return reply.status(400).send(error);
  }
}