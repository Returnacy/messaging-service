import { z } from 'zod';
import { payloadRecipientSchema } from './payloadRecipientSchema.js';

export const messagePayloadSchema = z.object({
  subject: z.string().min(2).max(100).nullable(),
  // Allow rich HTML templates (styles inline). Upper bound raised to 20000 chars.
  bodyHtml: z.string().min(2).max(50000).nullable(),
  // Allow longer plain text fallback for links and disclaimers
  bodyText: z.string().min(2).max(7500),
  from: z.string().min(2).max(100),
  to: payloadRecipientSchema,
});