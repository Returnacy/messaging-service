import { z } from 'zod';
import { payloadRecipientSchema } from './zod/payloadRecipientSchema.ts';

export type PayloadRecipient = z.infer<typeof payloadRecipientSchema>;