// plugins/keycloakAuthPlugin.ts
import fp from "fastify-plugin";
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";

export default fp(async (fastify) => {
  const jwksUrl = `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/certs`;
  fastify.log.info({ jwksUrl }, 'keycloak JWKS URL');

  const JWKS = createRemoteJWKSet(new URL(jwksUrl));

  // declare runtime property for TS - already done in your d.ts
  fastify.decorateRequest('auth', null);

  // Accept multiple issuers for dev + Docker
  const validIssuers = [
    `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}`,
  ];
  // For local testing use
  /* const validIssuers = [
    `http://localhost:8080/realms/${process.env.KEYCLOAK_REALM}`,
    `http://keycloak:8080/realms/${process.env.KEYCLOAK_REALM}`,
  ]; */

  fastify.addHook('preHandler', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    fastify.log.debug({ authHeader }, 'raw Authorization header');

    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.split(' ')[1];

    if (!token) {
      return reply.status(401).send({ error: 'Missing or invalid token' });
    }

    // 1) Decode without verification to inspect values
    try {
      const decoded = decodeJwt(token);
      fastify.log.info({
        iss: decoded.iss,
        aud: decoded.aud,
        exp: decoded.exp,
        now: Math.floor(Date.now() / 1000),
        realm_access: decoded.realm_access,
        resource_access_keys: decoded.resource_access ? Object.keys(decoded.resource_access) : undefined,
      }, 'decoded token (no signature verification)');
    } catch (err) {
      fastify.log.error({ err }, 'Failed to decode token payload');
      return reply.status(401).send({ error: 'Invalid token format' });
    }

    // 2) Verify JWT with multiple valid issuers
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: validIssuers, // accepts any of the listed issuers
        // audience can still be added if needed
      });

      fastify.log.info('jwt signature and issuer verified (audience not checked)');

      request.auth = payload as any;
      return;
    } catch (err) {
      fastify.log.error({ err }, 'jwtVerify failed when verifying signature+issuer (no audience)');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
});
