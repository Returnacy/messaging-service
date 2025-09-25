import { z } from 'zod';
import { messageSchema } from './messageSchema.js';

export const batchSchema = z.array(messageSchema);