import { z } from 'zod';

export const resendReceiptSchema = z.object({
  type: z.string(),
  created_at: z.string().refine((val: any) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  data: z.object({
    email_id: z.string(),
  }),
});