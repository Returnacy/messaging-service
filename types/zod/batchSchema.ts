import { z } from 'zod';
import { messagesSchema } from './messageSchema.js';

export const batchSchema = z.array(messagesSchema);