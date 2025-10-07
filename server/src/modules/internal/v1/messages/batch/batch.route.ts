import type { FastifyInstance } from "fastify";
import { requireServiceRole } from '../../../../../utils/serviceAuthGuard.js';
import { batchHandler } from "./batch.controller.js";

export async function batchRoutes(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireServiceRole("send"),
    handler: batchHandler
  });
}