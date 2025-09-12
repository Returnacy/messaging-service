// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { decisionTelecomService } from '@/modules/webhooks/decisiontelecom/decisiontelecom.service.js';
import { resendService } from '@/modules/webhooks/resend/resend.service.js';

vi.mock('@messaging-service/utils', () => ({ getQueue: vi.fn(() => ({ add: vi.fn() })) }));

const makeReq = () => ({ server: { redisConnection: {} } }) as unknown as FastifyRequest;

describe('webhook services', () => {
  it('decisiontelecom translates status and enqueues', async () => {
    const req = makeReq();
    const input = {
      message_id: 'm1',
      time_delivery: new Date().toISOString(),
      phone: '+1',
      status: 2,
      part_count: 1,
      concat_part: 1,
    } as any;
    await decisionTelecomService(req, input);
    const { getQueue } = await import('@messaging-service/utils');
    const q = vi.mocked(getQueue).mock.results.at(-1)!.value as any;
    expect(q.add).toHaveBeenCalledWith('decisiontelecom', expect.objectContaining({ providerMessageId: 'm1', status: 'DELIVERED' }));
  });

  it('resend translates event type and enqueues', async () => {
    const req = makeReq();
    const input = {
      type: 'email.bounced',
      created_at: new Date().toISOString(),
      data: { email_id: 'em_1' },
    } as any;
    await resendService(req, input);
    const { getQueue } = await import('@messaging-service/utils');
    const q = vi.mocked(getQueue).mock.results.at(-1)!.value as any;
    expect(q.add).toHaveBeenCalledWith('decisiontelecom', expect.objectContaining({ providerMessageId: 'em_1', status: 'BOUNCED' }));
  });
});
