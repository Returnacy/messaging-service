import fp from "fastify-plugin";

import { RepositoryPrisma } from "@messaging-service/db";

export default fp(async (fastify) => {
  const redisConnection = { host: 'redis', port: 6379, maxRetriesPerRequest: null };
  fastify.decorate("redisConnection", redisConnection);
});