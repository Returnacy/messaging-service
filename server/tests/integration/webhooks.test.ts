// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { webhooksRoutes } from '@/modules/webhooks/index.route.js';

vi.mock('@messaging-service/utils', () => {
  return {
    getQueue: vi.fn(() => ({ add: vi.fn() })),
  };
});

describe('webhooks routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(webhooksRoutes, { prefix: '/webhooks' });
  });

  it('accepts resend webhook and returns 202', async () => {
    const body = {
      type: 'email.delivered',
      created_at: new Date().toISOString(),
      data: { email_id: 'em_123' },
    };
    const res = await app.inject({ method: 'POST', url: '/webhooks/resend/', payload: body });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: true });
  });

  it('rejects invalid resend webhook with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/webhooks/resend/', payload: { type: 123 } });
    expect(res.statusCode).toBe(400);
  });

  it('accepts decisiontelecom webhook and returns 202', async () => {
    const body = {
      message_id: 'msg-1',
      time_delivery: new Date().toISOString(),
      phone: '+1234567890',
      status: 2,
      part_count: 1,
      concat_part: 1,
    };
    const res = await app.inject({ method: 'POST', url: '/webhooks/decisiontelecom/', payload: body });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: true });
  });

  it('rejects invalid decisiontelecom webhook with 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/webhooks/decisiontelecom/', payload: { message_id: 'x' } });
    expect(res.statusCode).toBe(400);
  });
});
