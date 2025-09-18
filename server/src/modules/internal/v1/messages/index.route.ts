import type { FastifyInstance } from 'fastify';

import { messagesRoute } from "./messages.route.js";
import { batchRoutes } from './batch/batch.route.js';
import { messageRoutes } from './message/message.route.js';

export async function messagesRoutes(server: FastifyInstance) {
  server.register(messagesRoute);
  server.register(batchRoutes, { prefix: '/batch' });
  server.register(messageRoutes);
}