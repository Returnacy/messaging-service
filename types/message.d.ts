import { MessagePayload } from "./messagePayload.js";
import { Channel } from "./channel.js";

export type Message = {
  externalId: string;
  campaignId?: string | null | undefined;
  recipientId: string;
  channel: Channel;
  payload: MessagePayload;
  scheduledAt?: Date | null | undefined;
  maxAttempts: number;
}