import { Channel } from "./channel.js";

export type Provider = {
  id: string;
  name: string;
  channel: Channel;
  credentialRef: string;
}