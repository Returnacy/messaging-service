import type { FastifyReply, FastifyRequest } from 'fastify';

// Simple in-memory counters (reset on restart). Replace later with Prometheus or OTEL metrics.
const metrics = {
  startTime: Date.now(),
  eventsPublished: 0,
  eventsFailed: 0,
};

export function incrementMetric(name: keyof typeof metrics) {
  if (name in metrics) {
    // @ts-ignore
    metrics[name]++;
  }
}

export async function getHealthHandler(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: 'ok', uptimeSeconds: process.uptime(), timestamp: new Date().toISOString() });
}

export async function getReadinessHandler(req: FastifyRequest, reply: FastifyReply) {
  const start = Date.now();
  let dbHealthy = false;
  let redisHealthy = false;
  try {
    // @ts-ignore
    await req.server.repository?.healthCheck?.();
    dbHealthy = true;
  } catch {}
  try {
    // @ts-ignore
    const redis = req.server.redisConnection as any;
    if (redis) {
      const pong = await redis.ping();
      redisHealthy = pong === 'PONG';
    }
  } catch {}
  const latencyMs = Date.now() - start;
  const overall = dbHealthy && redisHealthy;
  return reply.status(overall ? 200 : 503).send({
    status: overall ? 'ready' : 'degraded',
    latencyMs,
    checks: { database: dbHealthy ? 'up' : 'down', redis: redisHealthy ? 'up' : 'down' }
  });
}

export async function getMetricsHandler(_req: FastifyRequest, reply: FastifyReply) {
  const uptimeSeconds = (Date.now() - metrics.startTime) / 1000;
  return reply.send({
    uptimeSeconds,
    eventsPublished: metrics.eventsPublished,
    eventsFailed: metrics.eventsFailed
  });
}
