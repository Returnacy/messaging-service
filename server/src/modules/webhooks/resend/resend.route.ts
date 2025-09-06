import type { FastifyInstance } from "fastify";
import { resendHandler } from "./resend.controller.js";

export async function resendRoutes(server: FastifyInstance) {
  server.post('/', {
    handler: resendHandler
  });
}