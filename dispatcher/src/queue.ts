import { Queue } from "bullmq";

const QUEUE_MAX_ATTEMPTS = 5;
const QUEUE_BACKOFF_DELAY_MS = 2000;

export function createQueue(queueName: string, connection: any) {
  return new Queue(queueName, {
    connection,
    defaultJobOptions: {
      attempts: Number(process.env.QUEUE_MAX_ATTEMPTS) || QUEUE_MAX_ATTEMPTS,
      backoff: { type: 'exponential', delay: Number(process.env.QUEUE_BACKOFF_DELAY_MS) || QUEUE_BACKOFF_DELAY_MS},
      removeOnComplete: 1000,
      removeOnFail: 10000,
    }
  });
}