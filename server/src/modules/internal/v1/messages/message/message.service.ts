import type { FastifyRequest } from "fastify";

import type { Message, MessageStatus } from "@messaging-service/types";
import { getQueue } from "@messaging-service/utils";

export async function messageService(request: FastifyRequest<{ Params: { id: string } }>) {
  const id = request.params.id;
  const msg = await request.server.repository.getMessageById(id);
  if (!msg) throw new Error('Message not found');
  return msg;
}