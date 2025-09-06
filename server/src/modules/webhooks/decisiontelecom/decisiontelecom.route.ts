import type { FastifyInstance } from "fastify";
import { decisionTelecomHandler } from "./decisiontelecom.controller.js";

export async function decisionTelecomRoutes(server: FastifyInstance) {
  server.post('/', {
    handler: decisionTelecomHandler
  });
}