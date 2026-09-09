import { Queue } from "bullmq";

export const DOCUMENT_QUEUE_NAME = process.env.DOCUMENT_QUEUE ?? "document-processing";

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 16379),
};

export const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, {
  connection: redisConnection,
});
