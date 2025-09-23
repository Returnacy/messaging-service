import { z } from 'zod';
import { messagesSchema } from '../zod/messageSchema.js';

export type Message = z.infer<typeof messagesSchema>;