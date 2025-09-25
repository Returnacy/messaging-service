import { z } from 'zod';

export const payloadRecipientSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(10).max(15).optional(),
  name: z.string().min(2).max(100),
});