import type { FastifyInstance } from "fastify";
import { requireRole } from '../../../../utils/authGuards.js';
import { messagesHandler } from "./messages.controller.js";

export async function messagesRoute(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireRole('send', 'messaging-service'),
    handler: messagesHandler
  });
}