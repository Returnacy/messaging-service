// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { processOutboundMessage } from '@/utils/processOutboundMessage.js';

vi.mock('@messaging-service/utils', () => ({
  getQueue: vi.fn(() => ({ add: vi.fn() })),
  computeMessageMinuteHash: vi.fn(() => 'hash-fixed-for-test'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processOutboundMessage', () => {
  const makeReq = (repoImpl: any = {}, redis: any = {}) => {
    return {
      server: {
        repository: {
          getOutboundMessageByIdempotencyKey: vi.fn().mockResolvedValue(null),
          createOutboundMessage: vi.fn().mockResolvedValue({ id: 'm1', status: 'QUEUED' }),
          ...repoImpl,
        },
        redisConnection: redis,
      },
    } as unknown as FastifyRequest;
  };

  it('adds dispatch job when message is QUEUED', async () => {
    const request = makeReq();
    const { getQueue } = await import('@messaging-service/utils');
    const queue = { add: vi.fn() };
    vi.mocked(getQueue).mockReturnValue(queue as any);

    const result = await processOutboundMessage(request, {
      recipientId: 'c2c5d2f4-8d6a-4c1a-9b2b-1a2b3c4d5e6f',
      campaignId: null,
      channel: 'EMAIL',
      payload: {
        subject: 'Hi',
        bodyHtml: null,
        bodyText: 'text',
        from: 'noreply@example.com',
        to: { email: 'a@b.com', name: 'A' },
      },
      scheduledAt: null,
      maxAttempts: 1,
    } as any);

    expect(result.id).toBe('m1');
  expect(queue.add).toHaveBeenCalledWith('dispatch', expect.objectContaining({ id: 'm1' }));
  });

  it('does not add job when message not QUEUED', async () => {
    const request = makeReq({
      createOutboundMessage: vi.fn().mockResolvedValue({ id: 'm2', status: 'SENT' }),
    });
    const { getQueue } = await import('@messaging-service/utils');
    const queue = { add: vi.fn() };
    vi.mocked(getQueue).mockReturnValue(queue as any);

    // Provide minimal valid message shape so hashing logic has required fields
    await processOutboundMessage(request, {
      recipientId: 'recipient-x',
      campaignId: null,
      channel: 'EMAIL',
      payload: {
        subject: 'S',
        bodyHtml: null,
        bodyText: 'tx',
        from: 'noreply@example.com',
        to: { email: 'x@example.com' },
      },
      scheduledAt: null,
      maxAttempts: 1,
    } as any);

    expect(queue.add).not.toHaveBeenCalled();
    expect(getQueue).not.toHaveBeenCalled();
  });

  // idempotency-key is now server-side; no longer throws for missing header or table
});