import { documentWorker } from "./worker-doc.js";
import { flowchartWorker } from "./worker-flowchart.js";
import { templateWorker } from "./worker-template.js";

const workers = [documentWorker, templateWorker, flowchartWorker];

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
