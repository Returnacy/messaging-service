import type { FastifyInstance } from "fastify";
import { requireServiceRole } from '../../../../utils/serviceAuthGuard.js';
import { messagesHandler } from "./messages.controller.js";

export async function messagesRoute(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireServiceRole('send', 'messaging-service'),
    handler: messagesHandler
  });
}