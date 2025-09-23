import { z } from 'zod';
import { payloadRecipientSchema } from './zod/payloadRecipientSchema.js';

export type PayloadRecipient = z.infer<typeof payloadRecipientSchema>;