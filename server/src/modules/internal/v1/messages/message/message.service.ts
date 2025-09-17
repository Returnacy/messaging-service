import type { FastifyRequest } from "fastify";

export async function messageService(request: FastifyRequest<{ Params: { id: string } }>) {
  const id = request.params.id;
  const msg = await request.server.repository.getMessageById(id);
  if (!msg) throw new Error('Message not found');
  return msg;
}