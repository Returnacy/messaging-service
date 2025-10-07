import type { FastifyInstance } from "fastify";
import { requireServiceRole } from '../../../../../utils/serviceAuthGuard.js';
import { messageHandler } from "./message.controller.js";

export async function messageRoutes(server: FastifyInstance) {
  server.post('/:id', {
    preHandler: requireServiceRole('read', 'messaging-service'),
    handler: messageHandler
  });
}