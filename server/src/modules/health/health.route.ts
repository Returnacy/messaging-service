import type { FastifyInstance } from 'fastify';
import { getHealthHandler, getReadinessHandler, getMetricsHandler } from './health.controller.js';

export async function healthRoutes(server: FastifyInstance) {
  server.get('/health', { handler: getHealthHandler });
  server.get('/ready', { handler: getReadinessHandler });
  server.get('/metrics', { handler: getMetricsHandler });
}
