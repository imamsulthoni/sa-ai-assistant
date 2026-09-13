import { Worker } from "bullmq";
import { DOCUMENT_QUEUE_NAME, redisConnection } from "../lib/queue.js";
import { processDocument } from "./process-document.js";

export const documentWorker = new Worker(DOCUMENT_QUEUE_NAME, processDocument, {
  connection: redisConnection,
  concurrency: 2,
});
