// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { requireServiceRole } from '../../../src/utils/serviceAuthGuard.js';

function makeReply() {
  return {
    statusCode: 200,
    payload: null as any,
    status(code: number) { this.statusCode = code; return this; },
    send(body: any) { this.payload = body; return this; },
  } as any;
}

describe('requireServiceRole', () => {
  it('allows when role in realm_access', async () => {
    const pre = requireServiceRole('admin');
    const request = { auth: { realm_access: { roles: ['admin'] } } } as any;
    const reply = makeReply();
    await pre(request, reply);
    expect(reply.statusCode).toBe(200);
  });

  it('allows when role in resource_access specific client', async () => {
    const pre = requireServiceRole('send', 'messaging-service');
    const request = { auth: { resource_access: { 'messaging-service': { roles: ['send'] } } } } as any;
    const reply = makeReply();
    await pre(request, reply);
    expect(reply.statusCode).toBe(200);
  });

  it('allows when role in any client', async () => {
    const pre = requireServiceRole('read');
    const request = { auth: { resource_access: { foo: { roles: ['read'] } } } } as any;
    const reply = makeReply();
    await pre(request, reply);
    expect(reply.statusCode).toBe(200);
  });

  it('denies when role missing', async () => {
    const pre = requireServiceRole('admin');
    const request = { auth: { realm_access: { roles: [] }, resource_access: {} } } as any;
    const reply = makeReply();
    await pre(request, reply);
    expect(reply.statusCode).toBe(403);
    expect(reply.payload).toEqual({ error: 'Forbidden' });
  });
});
