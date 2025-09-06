import type { FastifyInstance } from "fastify";
import { requireRole } from '../../../../../utils/authGuards.js';
import { batchHandler } from "./batch.controller.js";

export async function batchRoutes(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireRole("send"),
    handler: batchHandler
  });
}