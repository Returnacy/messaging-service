// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { messagesService } from '@/modules/internal/v1/messages/messages.service.js';
import { batchService } from '@/modules/internal/v1/messages/batch/batch.service.js';
import { processOutboundMessage } from '@/utils/processOutboundMessage.js';

vi.mock('@/utils/processOutboundMessage.js', () => ({
  // New signature: (request, input)
  processOutboundMessage: vi.fn(async (_req, _input) => ({ id: 'm1', status: 'QUEUED' })),
}));

describe('messages services', () => {
  const makeReq = (headers: any = {}, repoImpl: any = {}) => {
    return {
      headers,
      server: {
        repository: {
          createIdempotencyKey: vi.fn().mockResolvedValue({ key: 'idem-1' }),
          createOutboundMessage: vi.fn().mockResolvedValue({ id: 'm1' }),
          ...repoImpl,
        },
        redisConnection: {},
      },
    } as unknown as FastifyRequest;
  };

  it('messagesService processes message without idempotency header', async () => {
    const req = makeReq({});
    const res = await messagesService(req, {} as any);
    expect(res).toEqual({ messageId: 'm1' });
  });

  it('messagesService handles a valid message payload', async () => {
    const req = makeReq({});
    const res = await messagesService(req, {
      campaignId: null,
      recipientId: 'c2c5d2f4-8d6a-4c1a-9b2b-1a2b3c4d5e6f',
      channel: 'EMAIL',
      payload: {
        subject: null,
        bodyHtml: null,
        bodyText: 'txt',
        from: 'x',
        to: { email: 'a@b.com', name: 'A' },
      },
      scheduledAt: new Date(),
      maxAttempts: 1,
    } as any);
    expect(res).toEqual({ messageId: 'm1' });
  });

  it('batchService processes multiple messages', async () => {
    const req = makeReq({});
    const res = await batchService(req, [{}, {}] as any);
    expect(res.messageId).toHaveLength(2);
  });
});
