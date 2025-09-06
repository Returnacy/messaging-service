import type { FastifyInstance } from 'fastify';

import { resendRoutes } from "./resend/resend.route.js";
import { decisionTelecomRoutes } from './decisiontelecom/decisiontelecom.route.js';

export async function webhooksRoutes(server: FastifyInstance) {
  server.register(resendRoutes, { prefix: '/resend' });
  server.register(decisionTelecomRoutes, { prefix: '/decisiontelecom' });
}