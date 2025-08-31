import fp from "fastify-plugin";
import { Redis } from "ioredis";

export default fp(async (fastify) => {
  const redisConnection = new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
  });
  fastify.decorate("redisConnection", redisConnection);
});