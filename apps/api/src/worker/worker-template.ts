import { Worker } from "bullmq";
import { TEMPLATE_QUEUE_NAME, redisConnection } from "../lib/queue.js";
import { extractTemplate } from "./extract-template.js";

export const templateWorker = new Worker(TEMPLATE_QUEUE_NAME, extractTemplate, {
  connection: redisConnection,
  concurrency: 4,
});
