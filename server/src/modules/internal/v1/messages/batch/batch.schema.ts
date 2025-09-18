import { z } from 'zod';
import { messagesSchema } from '../messages.schema.js';

export const batchSchema = z.array(messagesSchema);

export type BatchInput = z.infer<typeof batchSchema>;