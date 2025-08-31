import { z } from 'zod';

export const sendSchema = z.object({
  campaignId: z.uuid().optional(),
  recipientId: z.uuid(),
  channel: z.enum(['EMAIL', 'SMS']),
  payload: z.object({
    subject: z.string().min(2).max(100),
    bodyHtml: z.string().min(2).max(1000).optional(),
    bodyText: z.string().min(2).max(1000),
    from: z.string().min(2).max(100),
    to: z.object({
      email: z.email().optional(),
      phone: z.string().min(10).max(15).optional(),
      name: z.string().min(2).max(100),
    }),
  }),
  scheduledAt: z.date().optional(),
  maxAttempts: z.number().min(1).default(1),
});

export type SendInput = z.infer<typeof sendSchema>;