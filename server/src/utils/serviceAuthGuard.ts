import type { FastifyReply, FastifyRequest } from 'fastify';

function hasServiceRole(request: FastifyRequest, role: string, clientId?: string): boolean {
  console.log(`Checking role: ${role}, clientId: ${clientId}`);
  console.log('Request auth object:', request.auth);

  // 1. Check realm roles
  const realmRoles = request.auth?.realm_access?.roles || [];
  if (realmRoles.includes(role)) return true;

  // 2. Check single client if provided
  if (clientId) {
    const clientRoles = request.auth?.resource_access?.[clientId]?.roles || [];
    if (clientRoles.includes(role)) return true;
  }

  // 3. Check all resource_access (search across clients)
  const resourceAccess = request.auth?.resource_access || {};
  for (const client of Object.keys(resourceAccess)) {
    const clientRoles = resourceAccess[client]?.roles || [];
    if (clientRoles.includes(role)) return true;
  }

  return false;
}

export function requireServiceRole(role: string, clientId?: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!hasServiceRole(request, role, clientId)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
  };
}
