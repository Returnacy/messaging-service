import { z } from 'zod';
import { messagePayloadSchema } from './messagePayloadSchema.js';
import type { Channel } from '../channel.js';

export const messageSchema = z.object({
  campaignId: z.uuid().nullable(),
  recipientId: z.uuid(),
  idempotencyKey: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS']) as z.ZodType<Channel>,
  payload: messagePayloadSchema,
  scheduledAt: z.date().nullable(),
  maxAttempts: z.number().min(1).default(1),
});