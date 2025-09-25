import { z } from 'zod';
import { payloadRecipientSchema } from './payloadRecipientSchema.js';

export const messagePayloadSchema = z.object({
  subject: z.string().min(2).max(100).nullable(),
  bodyHtml: z.string().min(2).max(1000).nullable(),
  bodyText: z.string().min(2).max(1000),
  from: z.string().min(2).max(100),
  to: payloadRecipientSchema,
});