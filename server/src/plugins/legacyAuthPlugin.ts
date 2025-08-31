import fp from "fastify-plugin";

const DEV_PASSWORD = process.env.DEV_PASSWORD || 'devpass';

export default fp(async (fastify) => {
  fastify.decorateRequest('auth', null);

  fastify.addHook('preHandler', async (request, reply) => {
    const devPassword = request.headers['x-dev-password'];
    if (devPassword !== DEV_PASSWORD) {
      return reply.status(401).send({ error: 'Unauthorized (dev auth)' });
    }

    // Fake Keycloak-like auth object
    request.auth = {
      realm_access: { roles: ['admin', 'user'] },
      resource_access: {
        'messaging-service': { roles: ['send', 'read'] }
      },
      preferred_username: 'devuser'
    };
  });
});