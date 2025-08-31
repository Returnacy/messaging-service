export type MessagePayload = {
  subject?: string | null | undefined;
  bodyHtml?: string | null | undefined;
  bodyText: string;
  from: string;
  to: {
    name: string;
    email?: string | null | undefined;
    phone?: string | null | undefined;
  }
  metadata?: Record<string, any>;
}