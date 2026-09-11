import { MistralClient } from "@anvia/mistral";
import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import type { FlowchartVerificationJob } from "../lib/queue.js";

const mistral = new MistralClient({ apiKey: process.env.MISTRAL_API_KEY ?? "" });
const ocrModel = mistral.ocrModel({
  modelId: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest",
});

function normalizeTerms(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[`*_#()[\]{}:;,.!?/\\-]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length >= 5),
  );
}

function compareFlowchartToBrd(flowchart: string, brd: string) {
  const flowTerms = normalizeTerms(flowchart);
  const requirements = brd
    .split(/(?=^###\s+(?:FR|BR)-\d+)/gim)
    .map((section) => section.trim())
    .filter(Boolean);
  const matches: string[] = [];
  const gaps: string[] = [];
  for (const requirement of requirements) {
    const id = requirement.match(/\b(?:FR|BR)-\d+\b/i)?.[0] ?? "Requirement";
    const terms = normalizeTerms(requirement);
    const overlap = [...terms].filter((term) => flowTerms.has(term));
    if (overlap.length >= Math.max(1, Math.min(3, Math.ceil(terms.size / 5)))) {
      matches.push(`${id}: ${overlap.slice(0, 5).join(", ")}`);
    } else {
      gaps.push(`${id}: requirement terms are not represented in the flowchart`);
    }
  }
  return { matches, gaps };
}

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
    const brd = job.data.brdDocumentId
      ? await prisma.brdDocument.findFirst({
          where: { id: job.data.brdDocumentId, userId: document.userId },
          select: { contentMarkdown: true },
        })
      : null;
    const comparison = brd
      ? compareFlowchartToBrd(flowchart, brd.contentMarkdown)
      : { matches: [], gaps: ["No BRD was selected for comparison."] };
    const report = {
      brdDocumentId: job.data.brdDocumentId ?? null,
      extractedText: flowchart,
      matches: comparison.matches,
      gaps: comparison.gaps,
      recommendations: [
        brd
          ? "Review each gap with the System Analyst before accepting the flowchart."
          : "Select an active BRD and rerun verification.",
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
