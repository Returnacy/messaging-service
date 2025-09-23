import { z } from 'zod';
import { messagePayloadSchema } from './messagePayloadSchema.js';
import type { Channel } from '../channel.js';

export const messagesSchema = z.object({
  campaignId: z.uuid().nullable(),
  recipientId: z.uuid(),
  channel: z.enum(['EMAIL', 'SMS']) as z.ZodType<Channel>,
  payload: messagePayloadSchema,
  scheduledAt: z.date().nullable(),
  maxAttempts: z.number().min(1).default(1),
});