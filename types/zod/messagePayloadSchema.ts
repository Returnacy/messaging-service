import { z } from 'zod';
import { payloadRecipientSchema } from './payloadRecipientSchema.js';

export const messagePayloadSchema = z.object({
  // HTML emails (templates + inline styles) easily exceed 1k chars; 100k is ample, providers accept orders of magnitude more.
  subject: z.string().min(2).max(200).nullable(),
  bodyHtml: z.string().min(2).max(100_000).nullable(),
  bodyText: z.string().min(2).max(20_000),
  from: z.string().min(2).max(100),
  to: payloadRecipientSchema,
});