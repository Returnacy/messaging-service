// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { messagesRoute } from '@/modules/internal/v1/messages/messages.route.js';
import { processOutboundMessage } from '@/utils/processOutboundMessage.js';

vi.mock('@/utils/processOutboundMessage.js', () => ({
  processOutboundMessage: vi.fn(),
}));

// ~2 000 chars, shaped like the user-service transactional templates (inline styles)
const realisticHtml = (
  '<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0">' +
  '<tr><td align="center"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;padding:32px">' +
  '<tr><td style="font-size:22px;font-weight:700;color:#111827;padding-bottom:16px">Reimposta la tua password</td></tr>' +
  '<tr><td style="font-size:15px;line-height:22px;color:#374151;padding-bottom:24px">Ciao Mario, abbiamo ricevuto una richiesta di reimpostazione della password. Clicca il pulsante qui sotto per sceglierne una nuova. Il link scade tra 60 minuti.</td></tr>' +
  '<tr><td align="center" style="padding-bottom:24px"><a href="https://app.example.com/reset-password?token=abcdef0123456789abcdef0123456789" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px">Reimposta password</a></td></tr>' +
  '<tr><td style="font-size:13px;line-height:20px;color:#6b7280">Se non hai richiesto tu la reimpostazione, ignora questa email: la tua password resterà invariata.</td></tr>'
).padEnd(1_950, ' ') + '</table></td></tr></table></body></html>';

describe('POST / (messages route)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.mocked(processOutboundMessage).mockResolvedValue({ id: 'm1', status: 'QUEUED' });
    app = Fastify();
    // Stand-in for the auth plugin: grant the 'send' service role
    app.addHook('onRequest', async (req) => {
      req.auth = { realm_access: { roles: ['send'] } };
    });
    await app.register(messagesRoute);
  });

  it('accepts a ~2 000 char HTML email and returns 202 { messageId }', async () => {
    expect(realisticHtml.length).toBeGreaterThan(1_900);
    const res = await app.inject({
      method: 'POST',
      url: '/',
      payload: {
        campaignId: null,
        recipientId: 'c2c5d2f4-8d6a-4c1a-9b2b-1a2b3c4d5e6f',
        idempotencyKey: 'reset-password-1',
        channel: 'EMAIL',
        payload: {
          subject: 'Reimposta la tua password',
          bodyHtml: realisticHtml,
          bodyText: 'Ciao Mario, apri questo link per reimpostare la password: https://app.example.com/reset-password?token=abcdef',
          from: 'Returnacy <noreply@returnacy.app>',
          to: { email: 'mario@example.com', name: 'Mario' },
        },
        scheduledAt: null,
        maxAttempts: 1,
      },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ messageId: 'm1' });
  });
});
