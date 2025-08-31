import { Resend } from "resend";

import type { OutboundMessage } from "@messaging-service/types";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendWithResendAdapter(message: OutboundMessage): Promise<boolean> {
  if (!message.payload.to.email) {
    console.error(`${message.payload.to.name}, no email address provided`);
    return false;
  }

  const { data, error } = await resend.emails.send({
    from: message.payload.from,
    to: [message.payload.to.email],
    subject: message.payload.subject || "Oggetto",
    html: message.payload.bodyHtml || "<strong>Ciao!</strong>",
  });

  if (error) {
    return false;
  }
  
  return true;
}
