// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { processOutboundMessage } from '@/utils/processOutboundMessage.js';

vi.mock('@messaging-service/utils', () => {
  return {
    getQueue: vi.fn(() => ({ add: vi.fn() })),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processOutboundMessage', () => {
  const makeReq = (repoImpl: any = {}, redis: any = {}) => {
    return {
      server: {
        repository: {
          createIdempotencyKey: vi.fn().mockResolvedValue({ key: 'idem-1' }),
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

    const result = await processOutboundMessage(request, 'idem-1', {
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

    await processOutboundMessage(request, 'idem-2', {} as any);

    expect(queue.add).not.toHaveBeenCalled();
    expect(getQueue).not.toHaveBeenCalled();
  });

  it('throws when idempotency key cannot be created', async () => {
    const request = makeReq({
      createIdempotencyKey: vi.fn().mockResolvedValue(null),
    });
    await expect(processOutboundMessage(request, 'idem-x', {} as any)).rejects.toThrow('Failed to create idempotency key');
  });
});