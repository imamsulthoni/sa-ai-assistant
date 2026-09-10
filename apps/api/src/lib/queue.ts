import { Queue } from "bullmq";

export const DOCUMENT_QUEUE_NAME = "doc-ingestion";
export const LEGACY_DOCUMENT_QUEUE_NAME = process.env.DOCUMENT_QUEUE;
export const TEMPLATE_QUEUE_NAME = "template-extract";
export const FLOWCHART_QUEUE_NAME = "flowchart-verify";

export const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 16379),
};

export const documentQueue = new Queue(DOCUMENT_QUEUE_NAME, {
  connection: redisConnection,
});

export const templateQueue = new Queue(TEMPLATE_QUEUE_NAME, {
  connection: redisConnection,
});

export const flowchartQueue = new Queue(FLOWCHART_QUEUE_NAME, {
  connection: redisConnection,
});

export type DocumentIngestionJob = { documentId: string; objectKey: string };
export type TemplateExtractionJob = { documentId: string; objectKey: string };
export type FlowchartVerificationJob = {
  documentId: string;
  objectKey: string;
  brdDocumentId?: string;
};

export const retryPolicies = {
  ingestion: { attempts: 3, backoff: { type: "exponential" as const, delay: 1000 } },
  template: { attempts: 1 },
  flowchart: { attempts: 2, backoff: { type: "exponential" as const, delay: 1000 }, priority: 1 },
};
