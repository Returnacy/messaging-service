import { z } from 'zod';
import { sendSchema } from '../send/send.schema.js';

export const batchSchema = z.array(sendSchema);

export type BatchInput = z.infer<typeof batchSchema>;