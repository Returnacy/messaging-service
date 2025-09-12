import type { FastifyInstance } from "fastify";
import { requireRole } from '../../../../../utils/authGuards.js';
import { messageHandler } from "./message.controller.js";

export async function messageRoutes(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireRole('read', 'messaging-service'),
    handler: messageHandler
  });
}