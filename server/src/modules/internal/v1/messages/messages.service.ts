import type { FastifyRequest } from "fastify";
import type { Message } from "@messaging-service/types";

import { processOutboundMessage } from "../../../../utils/processOutboundMessage.js";

export async function messagesService(request: FastifyRequest, input: Message) {
  const outboundMsg = await processOutboundMessage(request, input);

  return { messageId: outboundMsg.id };
}