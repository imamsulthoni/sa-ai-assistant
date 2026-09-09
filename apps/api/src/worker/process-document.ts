import { generateCompletion } from "@anvia/core";
import { embedDocuments } from "@anvia/core/embeddings";
import { MistralClient } from "@anvia/mistral";
import {
  DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
  loadTransformersEmbeddingModel,
} from "@anvia/transformers";
import { OpenAIClient } from "@anvia/openai";
import { QdrantVectorClient } from "@anvia/qdrant";
import type { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";

type DocumentJob = {
  id: string;
  objectKey: string;
  name: string;
};

type Page = {
  pageNumber: number;
  content: string;
  metadata: Record<string, string | number | boolean | null>;
};

const mistral = new MistralClient({
  apiKey: process.env.MISTRAL_API_KEY ?? "",
});
const ocrModel = mistral.ocrModel({
  modelId: process.env.MISTRAL_OCR_MODEL ?? "mistral-ocr-latest",
});

const openai = new OpenAIClient({
  apiKey: process.env.OPENAI_API_KEY ?? "",
  ...(process.env.OPENAI_BASE_URL
    ? { baseUrl: process.env.OPENAI_BASE_URL }
    : {}),
});
const summaryModel = openai.completionModel({
  modelId: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
});

const qdrant = new QdrantVectorClient({
  url: process.env.QDRANT_URL ?? "http://127.0.0.1:6333",
});
const vectorStore = qdrant.vectorStore({
  collectionName: "documents",
  dimensions: 384,
  metric: "cosine",
});

let embeddingModelPromise: ReturnType<typeof loadTransformersEmbeddingModel> | undefined;

function embeddingModel() {
  embeddingModelPromise ??= loadTransformersEmbeddingModel({
    modelId: DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
  });
  return embeddingModelPromise;
}

async function summarizeDocument(pages: Page[]) {
  const input = pages
    .slice(0, 4)
    .map((page) => `Page ${page.pageNumber}\n${page.content}`)
    .join("\n\n");

  const result = await generateCompletion({
    model: summaryModel,
    instructions: "Summarize what this document is about. Keep the summary concise.",
    prompt: input,
    maxTokens: 500,
  });

  return result.text;
}

export async function processDocument(job: Job<DocumentJob>) {
  const document = await prisma.document.findUnique({
    where: { id: job.data.id },
  });

  if (!document) return;

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING", error: null },
  });

  try {
    if (document.fileType === "MARKDOWN") {
      await prisma.document.update({
        where: { id: document.id },
        data: { status: "READY" },
      });
      return;
    }

    const result = await ocrModel.ocr({
      source: { type: "document_url", url: document.storageUrl },
      includeImageBase64: false,
    });

    const pages: Page[] = result.pages.map((page) => ({
      pageNumber: page.index + 1,
      content: page.markdown,
      metadata: JSON.parse(
        JSON.stringify({
          images: page.images,
          tables: page.tables ?? [],
          hyperlinks: page.hyperlinks ?? [],
          header: page.header ?? null,
          footer: page.footer ?? null,
          dimensions: page.dimensions ?? null,
          confidenceScores: page.confidenceScores ?? null,
        }),
      ) as Record<string, string | number | boolean | null>,
    }));

    const summary = await summarizeDocument(pages);
    const ocrResult = pages.map((page) => page.content).join("\n\n");

    await prisma.$transaction([
      prisma.documentPage.deleteMany({ where: { documentId: document.id } }),
      prisma.documentPage.createMany({
        data: pages.map((page) => ({
          documentId: document.id,
          pageNumber: page.pageNumber,
          content: page.content,
          metadata: page.metadata,
        })),
      }),
      prisma.document.update({
        where: { id: document.id },
        data: { summary, ocrResult },
      }),
    ]);

    const embedded = await embedDocuments({
      model: await embeddingModel(),
      documents: pages,
      id: (page) => `${document.id}-page-${page.pageNumber - 1}`,
      content: (page) => page.content,
      metadata: (page) => ({
        documentId: document.id,
        documentName: document.title,
        pageNumber: page.pageNumber,
        metadata: JSON.stringify(page.metadata),
      }),
    });

    await vectorStore.ensure();
    await vectorStore.upsert({ documents: embedded.documents });

    await prisma.document.update({
      where: { id: document.id },
      data: { status: "READY", error: null },
    });
  } catch (error) {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message.slice(0, 1000) : "Processing failed",
      },
    });
    throw error;
  }
}
