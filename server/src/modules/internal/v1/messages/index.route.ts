import type { FastifyInstance } from 'fastify';

import { sendRoutes } from "./send/send.route.js";
import { scheduleRoutes } from './schedule/schedule.route.js';
import { batchRoutes } from './batch/batch.route.js';

export async function messagesRoutes(server: FastifyInstance) {
  server.register(sendRoutes, { prefix: '/send' });
  server.register(scheduleRoutes, { prefix: '/schedule' });
  server.register(batchRoutes, { prefix: '/batch' });
}