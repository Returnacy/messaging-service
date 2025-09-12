import type { FastifyInstance } from "fastify";
import { requireRole } from '../../../../../utils/authGuards.js';
import { sendHandler } from "./send.controller.js";

export async function sendRoutes(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireRole('send', 'messaging-service'),
    handler: sendHandler
  });
}