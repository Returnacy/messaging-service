import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, decodeJwt } from 'jose';
import type {JWTVerifyOptions} from 'jose';

export default fp(async (fastify, opts) => {
  // Required env config
  const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL;
  const REALM = process.env.KEYCLOAK_REALM;
  if (!KEYCLOAK_BASE_URL || !REALM) {
    fastify.log.error('Missing KEYCLOAK_BASE_URL or KEYCLOAK_REALM env vars');
    throw new Error('Keycloak configuration missing');
  }

  // JWKS URL
  const jwksUrl = `${KEYCLOAK_BASE_URL}/realms/${REALM}/protocol/openid-connect/certs`;
  fastify.log.info({ jwksUrl }, 'Keycloak JWKS URL');

  const JWKS = createRemoteJWKSet(new URL(jwksUrl));

  // Allowed issuers: prefer single production issuer; allow overrides (dev / docker)
  // In production set KEYCLOAK_ISSUER to "https://auth.example.com/realms/yourrealm"
  const configuredIssuersEnv = process.env.KEYCLOAK_ISSUER;
  const validIssuers: string[] = configuredIssuersEnv
    ? configuredIssuersEnv.split(',').map(s => s.trim())
    : [
        `${KEYCLOAK_BASE_URL}/realms/${REALM}`,
        // optional dev values (only include explicitly via env if needed)
        'http://localhost:8080/realms/' + REALM,
        'http://keycloak:8080/realms/' + REALM
      ];

  // Optional audience check - set KEYCLOAK_AUDIENCE to the expected aud (client-id) for this resource server.
  const expectedAudience = process.env.KEYCLOAK_AUDIENCE || process.env.KEYCLOAK_CLIENT_ID || null;

  // small leeway for clock skew (in seconds)
  const CLOCK_TOLERANCE_SECONDS = Number(process.env.KEYCLOAK_CLOCK_TOLERANCE_SECONDS || 60);

  // Decorate request with `auth` property (ensure you have TS typing elsewhere)
  // Provide default null value; 'any' avoids TS complaining at runtime
  fastify.decorateRequest('auth', null as any);

  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers['authorization'];
      if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
      }
      const token = authHeader.substring(7).trim();
      if (!token) return reply.status(401).send({ error: 'Missing token' });

      // decode for minimal logging (dev only). Do not log full token in production.
      if (process.env.NODE_ENV !== 'production') {
        try {
          const decoded = decodeJwt(token);
          fastify.log.debug({
            iss: decoded.iss,
            azp: decoded.azp,
            aud: decoded.aud,
            exp: decoded.exp,
            sub: decoded.sub
          }, 'Decoded token (no signature verification)');
        } catch (e) {
          fastify.log.debug({ err: e }, 'Failed to decode token payload for debug logging');
        }
      }

      // prepare verify options
      // jose accepts issuer:string | string[] and audience optional
      const verifyOptions: any = {
        issuer: validIssuers,
        // allow small clock skew
        clockTolerance: CLOCK_TOLERANCE_SECONDS
      } as JWTVerifyOptions;

      // optional audience enforcement - recommended for resource servers
      if (expectedAudience) {
        // audience can be string or array - we set expectedAudience
        verifyOptions.audience = expectedAudience;
      }

      // verify signature and claims
      const { payload } = await jwtVerify(token, JWKS, verifyOptions);

      // attach payload to request for downstream auth checks
      request.auth = payload;

      // good
      return;
    } catch (err: any) {
      // Don't leak internal error details to clients.
      fastify.log.debug({ err }, 'JWT verification failed (detailed logged at debug level)');
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
});
