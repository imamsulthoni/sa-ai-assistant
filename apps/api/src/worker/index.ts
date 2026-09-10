import { documentWorker } from "./worker-doc.js";
import { flowchartWorker } from "./worker-flowchart.js";
import { templateWorker } from "./worker-template.js";
import { Worker } from "bullmq";
import { LEGACY_DOCUMENT_QUEUE_NAME, redisConnection } from "../lib/queue.js";
import { processDocument } from "./process-document.js";

const legacyDocumentWorker =
  LEGACY_DOCUMENT_QUEUE_NAME && LEGACY_DOCUMENT_QUEUE_NAME !== documentWorker.name
    ? new Worker(LEGACY_DOCUMENT_QUEUE_NAME, processDocument, {
        connection: redisConnection,
        concurrency: 2,
      })
    : null;
const workers = [
  documentWorker,
  templateWorker,
  flowchartWorker,
  ...(legacyDocumentWorker ? [legacyDocumentWorker] : []),
];

for (const worker of workers) {
  worker.on("completed", (job) => console.log(`${worker.name} job ${job.id} completed`));
  worker.on("failed", (job, error) =>
    console.error(`${worker.name} job ${job?.id ?? "unknown"} failed`, error),
  );
}

const shutdown = async () => {
  await Promise.all(workers.map((worker) => worker.close()));
  process.exit(0);
};

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
