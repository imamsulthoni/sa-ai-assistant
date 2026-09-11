import { MistralClient } from "@anvia/mistral";
import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import type { FlowchartVerificationJob } from "../lib/queue.js";

const mistral = new MistralClient({ apiKey: process.env.MISTRAL_API_KEY ?? "" });
const ocrModel = mistral.ocrModel({
  modelId: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest",
});

export async function verifyFlowchart(job: Job<FlowchartVerificationJob>) {
  const document = await prisma.document.findUnique({ where: { id: job.data.documentId } });
  if (!document) return;
  await prisma.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING", error: null },
  });
  try {
    const result = await ocrModel.ocr({
      source: { type: "document_url", url: document.storageUrl },
      includeImageBase64: false,
    });
    const flowchart = result.pages.map((page) => page.markdown).join("\n\n");
    const report = {
      brdDocumentId: job.data.brdDocumentId ?? null,
      extractedText: flowchart,
      matches: [],
      gaps: job.data.brdDocumentId
        ? ["BRD resolution is deferred until the BRD module exists."]
        : ["No BRD was selected for comparison."],
      recommendations: [
        "Select an active BRD and review the exposed gaps before accepting the flowchart.",
      ],
    };
    await prisma.document.update({
      where: { id: document.id },
      data: { report, ocrResult: flowchart, status: "READY", error: null },
    });
  } catch (error) {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        error:
          error instanceof Error ? error.message.slice(0, 1000) : "Flowchart verification failed",
      },
    });
    throw error;
  }
}
