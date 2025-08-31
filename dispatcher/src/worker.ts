import { Queue, Worker } from "bullmq";
import type { Processor } from './processor.js';

const WORKER_MAX_ATTEMPTS = 5;
const WORKER_BACKOFF_DELAY_MS = 2000;

export function createWorker(
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
      const result = await processor.processJob(job.data);

      logger.info({ jobId: job.id, queue: queueName }, 'processing job');

      if (result.failed && !result.finalFailure && retriesQueue) {
        await retriesQueue.add('retry', job.data);
        logger.info(`Moved job ${job.id} to retries queue`);
        return;
      } else if (result.failed && !result.finalFailure && !retriesQueue) {
        logger.warn(`Job ${job.id} failed but no retries queue available`);
        throw new Error('Job failed and no retries queue available, will retry in current queue');
      } else if (result.failed && result.finalFailure) {
        logger.warn(`Job ${job.id} failed permanently`);
      }

      return result;
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY || concurrency),
      limiter: {
        max: WORKER_MAX_ATTEMPTS,
        duration: WORKER_BACKOFF_DELAY_MS
      }
    }
  );
}