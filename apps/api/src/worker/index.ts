import { Worker } from "bullmq";
import { DOCUMENT_QUEUE_NAME, redisConnection } from "../lib/queue.js";
import { processDocument } from "./process-document.js";

const worker = new Worker(DOCUMENT_QUEUE_NAME, processDocument, {
  connection: redisConnection,
  concurrency: 2,
});

worker.on("completed", (job) => {
  console.log(`Document job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Document job ${job?.id ?? "unknown"} failed`, error);
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
