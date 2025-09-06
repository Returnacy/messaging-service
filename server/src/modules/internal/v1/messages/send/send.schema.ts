import { z } from 'zod';

export const sendSchema = z.object({
  campaignId: z.uuid().nullable(),
  recipientId: z.uuid(),
  channel: z.enum(['EMAIL', 'SMS']),
  payload: z.object({
    subject: z.string().min(2).max(100).nullable(),
    bodyHtml: z.string().min(2).max(1000).nullable(),
    bodyText: z.string().min(2).max(1000),
    from: z.string().min(2).max(100),
    to: z.object({
      email: z.email().optional(),
      phone: z.string().min(10).max(15).optional(),
      name: z.string().min(2).max(100),
    }),
  }),
  scheduledAt: z.date().nullable(),
  maxAttempts: z.number().min(1).default(1),
});

export type SendInput = z.infer<typeof sendSchema>;