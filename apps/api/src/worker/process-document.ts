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
import { documentUrl, downloadDocument } from "../modules/document/services.js";
import {
  templateQueue,
  retryPolicies,
  type DocumentIngestionJob,
} from "../lib/queue.js";
import mammoth from "mammoth";

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
  baseUrl: process.env.OPENAI_BASE_URL ?? "",
  apiKey: process.env.OPENAI_API_KEY ?? "",
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

let vectorStoreReady: Promise<void> | undefined;

function ensureVectorStore() {
  vectorStoreReady ??= vectorStore.ensure().catch((error) => {
    vectorStoreReady = undefined;
    if (error instanceof Error && /already exists/i.test(error.message)) return;
    throw error;
  });
  return vectorStoreReady;
}

let embeddingModelPromise:
  ReturnType<typeof loadTransformersEmbeddingModel> | undefined;

function embeddingModel() {
  embeddingModelPromise ??= loadTransformersEmbeddingModel({
    modelId: DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
  });
  return embeddingModelPromise;
}

async function summarizeDocument(pages: Page[]) {
  const input = pages
    .slice(0, 5)
    .map((page) => `Page ${page.pageNumber}\n${page.content}`)
    .join("\n\n");

  const result = await generateCompletion({
    model: summaryModel,
    instructions:
      "Summarize what this document is about. Keep the summary concise.",
    prompt: input,
  });

  return result.text;
}

async function pagesFromDocx(objectKey: string): Promise<Page[]> {
  const buffer = await downloadDocument(objectKey);
  const result = await mammoth.extractRawText({ buffer });
  return [
    {
      pageNumber: 1,
      content: result.value.trim(),
      metadata: { source: "mammoth", messages: result.messages.length },
    },
  ];
}

async function persistPages(
  documentId: string,
  pages: Page[],
  summary: string | null,
) {
  await prisma.$transaction([
    prisma.documentPage.deleteMany({ where: { documentId } }),
    prisma.documentPage.createMany({
      data: pages.map((page) => ({
        documentId,
        pageNumber: page.pageNumber,
        content: page.content,
        metadata: page.metadata,
      })),
    }),
    prisma.document.update({
      where: { id: documentId },
      data: { summary },
    }),
  ]);
}

export async function processDocument(job: Job<DocumentIngestionJob>) {
  const document = await prisma.document.findUnique({
    where: { id: job.data.documentId },
  });

  if (!document) return;

  await prisma.document.update({
    where: { id: document.id },
    data: { status: "PROCESSING", error: null },
  });

  try {
    let pages: Page[];
    if (document.fileType === "MARKDOWN") {
      pages = [
        {
          pageNumber: 1,
          content: (await downloadDocument(document.objectKey)).toString(
            "utf8",
          ),
          metadata: { source: "markdown" },
        },
      ];
    } else if (document.fileType === "DOCX") {
      pages = await pagesFromDocx(document.objectKey);
    } else {
      const result = await ocrModel.ocr({
        source: { type: "document_url", url: documentUrl(document.objectKey) },
        includeImageBase64: false,
      });

      pages = result.pages.map((page) => ({
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
    }

    const summary =
      document.fileType === "MARKDOWN" ? null : await summarizeDocument(pages);

    await persistPages(document.id, pages, summary);

    const embedded = await embedDocuments({
      model: await embeddingModel(),
      documents: pages,
      id: (page) => `${document.id}-page-${page.pageNumber - 1}`,
      content: (page) => page.content,
      metadata: (page) => ({
        documentId: document.id,
        documentName: document.title,
        userId: document.userId,
        sessionId: document.sessionId,
        pageNumber: page.pageNumber,
        metadata: JSON.stringify(page.metadata),
      }),
    });

    await ensureVectorStore();
    await vectorStore.upsert({ documents: embedded.documents });

    await prisma.document.update({
      where: { id: document.id },
      data: { status: "READY", error: null },
    });

    if (document.isTemplate) {
      await templateQueue.add(
        "extract-template",
        { documentId: document.id, objectKey: document.objectKey },
        retryPolicies.template,
      );
    }

    console.log("Process Document Success: ", {
      documentId: document.id,
      summary,
    });
  } catch (error) {
    console.log("Process Document Error: ", error);
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "FAILED",
        error:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Processing failed",
      },
    });
    throw error;
  }
}
