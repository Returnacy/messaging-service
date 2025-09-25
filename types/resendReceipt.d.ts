import { z } from 'zod';
import { resendReceiptSchema } from './zod/resendReceiptSchema.js';

export type ResendReceipt = z.infer<typeof resendReceiptSchema>;