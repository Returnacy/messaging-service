import { describe, it, expect } from 'vitest';
import * as Contracts from '@returnacy/event-contracts';
let { createEvent, validateEvent, EventTypes } = Contracts as any;
if (!EventTypes) {
  // Fallback: require the package root (exports provides CJS) instead of a non-exported subpath.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cjs = require('@returnacy/event-contracts');
  EventTypes = cjs.EventTypes;
  createEvent = cjs.createEvent;
  validateEvent = cjs.validateEvent;
  if (!EventTypes) {
    // Provide debugging information to help diagnose resolution issues.
    // eslint-disable-next-line no-console
    console.error('event-contracts exports keys', Object.keys(cjs));
  }
}

describe('event-contracts (messaging-service)', () => {
  it('creates and validates message.sent event', () => {
  expect(EventTypes).toBeTruthy();
  expect(EventTypes.MESSAGE_SENT).toBe('message.sent');
  const evt = createEvent({
      type: EventTypes.MESSAGE_SENT,
      version: 1,
      producer: 'messaging-service.dispatcher',
      payload: {
        messageId: 'm_123',
        provider: 'resend',
        channel: 'EMAIL',
        status: 'SENT',
        sentAt: new Date().toISOString()
      }
    });
    const res = validateEvent(evt);
    expect(res.ok).toBe(true);
    expect(res.event?.payload.status).toBe('SENT');
  });
});
