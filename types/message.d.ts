import { z } from 'zod';
import { messageSchema } from './zod/messageSchema.js';

export type Message = z.infer<typeof messageSchema>;