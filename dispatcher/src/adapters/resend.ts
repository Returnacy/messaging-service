import { Resend } from "resend";

import type { OutboundMessage } from "@messaging-service/types";
import type { ProviderResponse } from "./types/providerResponse.js";

const resend = new Resend(process.env.RESEND_API_KEY);

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
