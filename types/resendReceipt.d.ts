import { z } from 'zod';
import { resendReceiptSchema } from './zod/resendReceiptSchema.js';

export type ResendReceiptInput = z.infer<typeof resendReceiptSchema>;