import { z } from 'zod';
import { batchSchema } from './zod/batchSchema.js';

export type Batch = z.infer<typeof batchSchema>;