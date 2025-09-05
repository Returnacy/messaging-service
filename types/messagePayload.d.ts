import { PayloadRecipient } from "./paylodRecipient.d.ts"

export type MessagePayload = {
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText: string;
  from: string;
  to: PayloadRecipient;
  metadata?: Record<string, any>;
}