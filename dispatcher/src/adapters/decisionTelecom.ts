import type { OutboundMessage } from "@messaging-service/types";
import type { ProviderResponse } from "./types/providerResponse.js";
import type { decisionTelecomResponse } from "./types/decisionTelecomResponse.js";

const DECISIONTELECOM_SMS_VALIDITY_PERIOD = 120;

export async function sendWithDecisionTelecomAdapter(message: OutboundMessage): Promise<ProviderResponse> {
  if (!message.payload.to.phone) {
    console.error(`${message.payload.to.name}, no phone number provided`);
    throw new Error(`Failed to send SMS via DecisionTelecom: no phone number provided`);
  }

  const msg = JSON.stringify({
    "phone": message.payload.to.phone,
    "sender": message.payload.from,
    "text": message.payload.bodyText,
    "validity_period": DECISIONTELECOM_SMS_VALIDITY_PERIOD,
  });

  // Send the message using the DecisionTelecom API
  const response = await fetch("https://web.it-decision.com/v1/api/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${process.env.DECISIONTELECOM_API_KEY}`,
    },
    body: msg,
    redirect: "follow"
  }) as unknown as decisionTelecomResponse;

  if (!["ACCEPTD", "ENROUTE", "DELIVRD"].includes(response.message_data[0].status)) {
    console.error("Failed to send SMS via DecisionTelecom", response.message_data[0].status);
    throw new Error(`Failed to send SMS via DecisionTelecom: ${response.message_data[0].status}`);
  }

  return {
    outboundMessageId: message.id,
    providerId: message.providerId || 'unknown',
    providerMessageId: response.message_data[0].message_id.toString(),
    requestPayload: msg,
    responsePayload: response,
    httpStatus: 200
  } as ProviderResponse;
}
