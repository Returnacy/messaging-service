import { PayloadRecipient } from "./paylodRecipient.d.ts"

export type MessagePayload = {
  subject?: string | null | undefined;
  bodyHtml?: string | null | undefined;
  bodyText: string;
  from: string;
  to: PayloadRecipient;
  metadata?: Record<string, any>;
}