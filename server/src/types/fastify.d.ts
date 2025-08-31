import "fastify";

declare module 'fastify' {
  interface FastifyInstance {
    repository: RepositoryPrisma;
    redisConnection: { host: string; port: number; maxRetriesPerRequest: null | number };
  }
  interface FastifyRequest {
    auth: (JWTPayload & {
      realm_access?: { roles: string[] };
      resource_access?: Record<string, { roles: string[] }>;
    }) | null;
  }
}