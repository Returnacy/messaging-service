import { Queue, Worker } from "bullmq";
import type { Processor } from './processor.js';

const WORKER_MAX_ATTEMPTS = 5;
const WORKER_BACKOFF_DELAY_MS = 2000;

export function createMessageWorker(
  queueName: string,
  processor: Processor,
  logger: any,
  connection: any,
  concurrency: number = 5,
  retriesQueue?: Queue
) {
  return new Worker(
    queueName,
    async job => {
      // Log before processing for more natural ordering
      logger.info({ jobId: job.id, queue: queueName, messageId: job?.data?.id, status: job?.data?.status }, 'processing job');
      const result = await processor.processJob(job.data);

      if (result.failed && !result.finalFailure && retriesQueue) {
        await retriesQueue.add('retry', job.data);
        logger.info({ jobId: job.id, queue: queueName }, 'moved job to retries queue');
        return;
      } else if (result.failed && !result.finalFailure && !retriesQueue) {
        logger.warn({ jobId: job.id, queue: queueName }, 'job failed but no retries queue available');
        throw new Error('Job failed and no retries queue available, will retry in current queue');
      } else if (result.failed && result.finalFailure) {
        logger.warn({ jobId: job.id, queue: queueName }, 'job failed permanently');
      }

      return result;
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || concurrency),
      limiter: {
        max: Number(process.env.WORKER_MAX_ATTEMPTS || WORKER_MAX_ATTEMPTS),
        duration: Number(process.env.WORKER_BACKOFF_DELAY_MS || WORKER_BACKOFF_DELAY_MS)
      }
    }
  );
}

export function createReceiptWorker(
  queueName: string,
  processor: Processor,
  logger: any,
  connection: any,
  concurrency: number = 5,
) {
  return new Worker(
    queueName,
    async job => {
      const result = await processor.processDeliveryReceipt(job.data);
      logger.info({ jobId: job.id, queue: 'messages.updates' }, 'processed update job');
      return result;
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || concurrency),
    }
  );
}