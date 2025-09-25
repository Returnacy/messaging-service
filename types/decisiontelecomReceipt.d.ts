import { z } from 'zod';
import { decisionTelecomReceiptSchema } from './zod/decisiontelecomReceiptSchema';

export type DecisionTelecomReceipt = z.infer<typeof decisionTelecomReceiptSchema>;