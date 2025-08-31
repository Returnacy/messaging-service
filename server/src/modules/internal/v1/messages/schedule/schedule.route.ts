import type { FastifyInstance } from "fastify";
import { requireRole } from '../../../../../utils/authGuards.js';
import { scheduleHandler } from "./schedule.controller.js";

export async function scheduleRoutes(server: FastifyInstance) {
  server.post('/', {
    preHandler: requireRole("send"),
    handler: scheduleHandler
  });
}