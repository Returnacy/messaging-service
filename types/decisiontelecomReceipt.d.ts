import { z } from 'zod';
import { decisionTelecomReceiptSchema } from './zod/decisiontelecomReceiptSchema';

export type DecisionTelecomReceiptInput = z.infer<typeof decisionTelecomReceiptSchema>;