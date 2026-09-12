import { Worker } from "bullmq";
import { FLOWCHART_QUEUE_NAME, redisConnection } from "../lib/queue.js";
import { verifyFlowchart } from "./verify-flowchart.js";

export const flowchartWorker = new Worker(FLOWCHART_QUEUE_NAME, verifyFlowchart, {
  connection: redisConnection,
  concurrency: 4,
});
