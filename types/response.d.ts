import { MessageStatus } from "./messageStatus.js";

export type Response = {
  outboundMessageId: string;
  status: MessageStatus;
}