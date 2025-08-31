import "fastify";
import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    repository: RepositoryPrisma;
    redisConnection: Redis;
  }
  interface FastifyRequest {
    auth: (JWTPayload & {
      realm_access?: { roles: string[] };
      resource_access?: Record<string, { roles: string[] }>;
    }) | null;
  }
}