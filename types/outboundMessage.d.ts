import { Channel } from "./channel.js";
import { Provider } from "./provider.js";
import { MessagePayload } from "./messagePayload.js";
import { MessageStatus } from "./messageStatus.js";

export type OutboundMessage = {
  id: string;
  externalId: string;
  campaignId?: string | null;
  recipientId: string;
  providerId: string;
  channel: Channel;
  payload: MessagePayload;
  provider: Provider;
  status: MessageStatus;
  attempt: number;
  maxAttempts: number;
  scheduledAt?: Date | null;
}