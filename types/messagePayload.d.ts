import { PayloadRecipient } from "./payloadRecipient.js"

export type MessagePayload = {
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText: string;
  from: string;
  to: PayloadRecipient;
  metadata?: Record<string, any>;
}