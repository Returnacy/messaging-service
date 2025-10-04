import { Resend } from "resend";

import type { OutboundMessage } from "@messaging-service/types";
import type { ProviderResponse } from "./types/providerResponse.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_DRY_RUN = (process.env.RESEND_DRY_RUN === 'true') || process.env.NODE_ENV !== 'production';

let resend: Resend | null = null;
if (RESEND_API_KEY && !RESEND_DRY_RUN) {
  resend = new Resend(RESEND_API_KEY);
}

export async function sendWithResendAdapter(message: OutboundMessage): Promise<ProviderResponse> {
  if (!message.payload.to.email) {
    console.error(`${message.payload.to.name}, no email address provided`);
    throw new Error('No email address provided');
  }

  const requestPayload = {
    from: message.payload.from,
    to: [message.payload.to.email],
    subject: message.payload.subject || "Oggetto",
    html: message.payload.bodyHtml || "<strong>Ciao!</strong>",
  };

  // If dry-run or missing API key, simulate a successful send to avoid external calls in integration/local
  if (!resend) {
    const mockId = `resend_mock_${Math.random().toString(36).slice(2)}`;
    return {
      outboundMessageId: message.id,
      providerId: message.providerId || 'resend',
      providerMessageId: mockId,
      requestPayload,
      responsePayload: { mock: true, dryRun: true },
      httpStatus: 202,
    } as ProviderResponse;
  }

  const { data, error } = await resend.emails.send(requestPayload);

  if (error) {
    throw new Error(typeof error === 'string' ? error : (error.message || 'Resend send error'));
  }

  return {
    outboundMessageId: message.id,
    providerId: message.providerId || 'resend',
    providerMessageId: (data as any)?.id ?? null,
    requestPayload,
    responsePayload: data,
    httpStatus: 200,
  } as ProviderResponse;
}
