import { z } from 'zod';
import { batchSchema } from './zod/batchSchema.js';

export type BatchInput = z.infer<typeof batchSchema>;