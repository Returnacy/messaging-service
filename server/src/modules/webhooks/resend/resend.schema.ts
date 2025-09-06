import { z } from 'zod';

export const resendReceiptSchema = z.object({
  type: z.string(),
  created_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  data: z.object({
    email_id: z.string(),
  }),
});

export type ResendReceiptInput = z.infer<typeof resendReceiptSchema>;