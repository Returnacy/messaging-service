import { z } from 'zod';

export const decisionTelecomReceiptSchema = z.object({
  message_id: z.string(),
  time_delivery: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  phone: z.string(),
  status: z.number().int().refine((val) => [1, 2, 3, 4, 5, 6, 7, 8].includes(val), {
    message: 'Status must be an integer between 1 and 8',
  }),
  part_count: z.number().int().min(1),
  concat_part: z.number().int().min(1),
  
});

export type DecisionTelecomReceiptInput = z.infer<typeof decisionTelecomReceiptSchema>;