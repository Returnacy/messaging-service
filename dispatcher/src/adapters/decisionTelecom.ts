import type { OutboundMessage } from "@messaging-service/types";
import type { ProviderResponse } from "./types/providerResponse.js";
import type { decisionTelecomResponse } from "./types/decisionTelecomResponse.js";

const DECISIONTELECOM_SMS_VALIDITY_PERIOD = 120;

export async function sendWithDecisionTelecomAdapter(message: OutboundMessage): Promise<ProviderResponse> {
  if (!message?.payload?.to?.phone) {
    console.error(`${message?.payload?.to?.name ?? ''}, no phone number provided`);
    throw new Error(`Failed to send SMS via DecisionTelecom: no phone number provided`);
  }

  const apiKey = process.env.DECISIONTELECOM_API_KEY || process.env.DECISION_TELECOM_API_KEY;
  const dryRun = (process.env.DECISIONTELECOM_DRY_RUN === 'true') || (process.env.NODE_ENV !== 'production');
  const senderFromMessage = message?.payload?.from;
  const senderFromEnv = process.env.DECISIONTELECOM_SENDER || process.env.DECISION_TELECOM_SENDER;
  const sender = senderFromMessage || senderFromEnv || 'Returnacy';

  const requestPayload = {
    phone: message.payload.to.phone.replace('+', ''),
    sender,
    text: message.payload.bodyText,
    validity_period: DECISIONTELECOM_SMS_VALIDITY_PERIOD,
  } as const;

  // If dry-run or missing API key, simulate a successful send to avoid external calls in integration/local
  if (!apiKey || dryRun) {
    const mockId = `decision_telecom_mock_${Math.random().toString(36).slice(2)}`;
    return {
      outboundMessageId: message.id,
      providerId: message.providerId || 'decision-telecom',
      providerMessageId: mockId,
      requestPayload,
      responsePayload: { mock: true, dryRun: true },
      httpStatus: 202,
    } as ProviderResponse;
  }

  // Send the message using the DecisionTelecom API
  const res = await fetch("https://web.it-decision.com/v1/api/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${apiKey}`,
    },
    body: JSON.stringify(requestPayload),
    redirect: "follow"
  });

  let data: decisionTelecomResponse | null = null;
  try {
    data = await res.json() as decisionTelecomResponse;
  } catch (e) {
    const text = await res.text().catch(() => '');
    throw new Error(`DecisionTelecom: invalid JSON response (status ${res.status}): ${text}`);
  }

  if (!res.ok) {
    const code = data?.message_data?.[0]?.status ?? `HTTP_${res.status}`;
    throw new Error(`Failed to send SMS via DecisionTelecom: ${code}`);
  }

  const status = data?.message_data?.[0]?.status;
  if (!status || !["ACCEPTD", "ENROUTE", "DELIVRD"].includes(status)) {
    console.error("Failed to send SMS via DecisionTelecom", status);
    throw new Error(`Failed to send SMS via DecisionTelecom: ${status ?? 'UNKNOWN'}`);
  }

  const providerMessageId = String(data!.message_data[0].message_id);
  return {
    outboundMessageId: message.id,
    providerId: message.providerId || 'decision-telecom',
    providerMessageId,
    requestPayload,
    responsePayload: data,
    httpStatus: res.status || 200
  } as ProviderResponse;
}
