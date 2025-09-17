// @ts-nocheck
import { describe, it, expect, vi } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { messagesService } from '@/modules/internal/v1/messages/messages.service.js';
import { batchService } from '@/modules/internal/v1/messages/batch/batch.service.js';
import { processOutboundMessage } from '@/utils/processOutboundMessage.js';

vi.mock('@/utils/processOutboundMessage.js', () => ({
  processOutboundMessage: vi.fn(async (_req, _key, _input) => ({ id: 'm1', status: 'QUEUED' })),
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

  it('messagesService requires idempotency-key header', async () => {
    const req = makeReq({});
    await expect(messagesService(req, {} as any)).rejects.toThrow('Idempotency key is required');
  });

  it('messagesService processes message with idempotency-key', async () => {
    const req = makeReq({ 'idempotency-key': 'k1' });
    const res = await messagesService(req, {} as any);
    expect(res).toEqual({ messageId: 'm1' });
  });

  it('messagesService creates idempotency key and message', async () => {
    const req = makeReq({ 'idempotency-key': 'k2' });
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

  it('messagesService fails when idempotencyKey not created', async () => {
    vi.mocked(processOutboundMessage).mockRejectedValueOnce(new Error('Failed to create idempotency key'));
    const req = makeReq({ 'idempotency-key': 'k3' }, { createIdempotencyKey: vi.fn().mockResolvedValue(null) });
    await expect(messagesService(req, {} as any)).rejects.toThrow('Failed to create idempotency key');
  });

  it('batchService requires array of idempotency keys', async () => {
    const req = makeReq({ 'idempotency-key': 'not-array' });
    await expect(batchService(req, [] as any)).rejects.toThrow('Idempotency key is required');
  });

  it('batchService processes multiple messages', async () => {
    const req = makeReq({ 'idempotency-key': ['k1', 'k2'] });
    const res = await batchService(req, [{}, {}] as any);
    expect(res.messageId).toHaveLength(2);
  });
});
