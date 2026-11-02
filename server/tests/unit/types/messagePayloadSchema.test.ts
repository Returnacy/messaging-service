import { describe, it, expect } from 'vitest';
import { messagePayloadSchema } from '@messaging-service/types';

const base = {
  subject: 'Reimposta la password',
  bodyHtml: '<p>Ciao</p>',
  bodyText: 'Ciao',
  from: 'Returnacy <noreply@returnacy.app>',
  to: { email: 'a@b.com', name: 'Mario' },
};

function tooBigPath(input: unknown) {
  const res = messagePayloadSchema.safeParse(input);
  expect(res.success).toBe(false);
  return res.error!.issues.map((i) => [i.code, i.path.join('.')]);
}

describe('messagePayloadSchema size limits', () => {
  it('accepts a 5 000 char bodyHtml', () => {
    expect(messagePayloadSchema.safeParse({ ...base, bodyHtml: 'x'.repeat(5_000) }).success).toBe(true);
  });

  it('rejects a 100 001 char bodyHtml as too_big', () => {
    expect(tooBigPath({ ...base, bodyHtml: 'x'.repeat(100_001) })).toEqual([['too_big', 'bodyHtml']]);
  });

  it('accepts a 150 char subject', () => {
    expect(messagePayloadSchema.safeParse({ ...base, subject: 's'.repeat(150) }).success).toBe(true);
  });

  it('rejects a 20 001 char bodyText as too_big', () => {
    expect(tooBigPath({ ...base, bodyText: 't'.repeat(20_001) })).toEqual([['too_big', 'bodyText']]);
  });
});
