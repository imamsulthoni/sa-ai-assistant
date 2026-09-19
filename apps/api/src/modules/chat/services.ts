import {
  allowedToolsForPhase,
  createSystemAnalystAgent,
  normalizeTemplateStructure,
  type AgentContextAdapters,
  type BrdTemplateStructure,
} from "@sa-ai-assistant/agent";
import { PrismaMemoryStore } from "@anvia/memory-prisma";
import { retrieveDocuments, vectorFilter } from "@anvia/core/vector-store";
import { QdrantVectorClient } from "@anvia/qdrant";
import {
  loadTransformersEmbeddingModel,
  DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
} from "@anvia/transformers";
import { prisma } from "../../lib/prisma.js";
import { decryptSecret } from "../../lib/crypto.js";
import { agentCacheKey, agentFingerprint } from "./utils.js";
import type { AgentPhase } from "./types.js";

type CachedAgent = {
  fingerprint: string;
  agent: ReturnType<typeof createSystemAnalystAgent>;
};
const agentCache = new Map<string, CachedAgent>();

const memory = new PrismaMemoryStore({
  client: prisma,
  scopeKey: { metadataKeys: ["userId"] },
});

const qdrant = new QdrantVectorClient({
  url: process.env.QDRANT_URL ?? "http://127.0.0.1:6333",
});
const contextStore = qdrant.vectorStore({
  collectionName: "documents",
  dimensions: 384,
  metric: "cosine",
});
let contextEmbeddingModel:
  ReturnType<typeof loadTransformersEmbeddingModel> | undefined;

async function embeddingModel() {
  contextEmbeddingModel ??= loadTransformersEmbeddingModel({
    modelId: DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
  });
  return contextEmbeddingModel;
}

async function adaptersFor(
  userId: string,
  projectId: string,
  brdId?: string,
): Promise<AgentContextAdapters> {
  return {
    searchContext: async ({ query, filters, topK }) => {
      const results = await retrieveDocuments({
        query,
        topK,
        model: await embeddingModel(),
        store: contextStore,
        filter: vectorFilter.and(
          vectorFilter.eq("userId", filters.userId ?? userId),
          vectorFilter.eq("projectId", projectId),
        ),
      });
      return results.map((result) => ({
        documentId: String(result.metadata?.documentId ?? result.id),
        title:
          typeof result.metadata?.documentName === "string"
            ? result.metadata.documentName
            : null,
        pageNumber:
          typeof result.metadata?.pageNumber === "number"
            ? result.metadata.pageNumber
            : null,
        content:
          typeof result.document === "string"
            ? result.document
            : result.document != null
              ? JSON.stringify(result.document)
              : "",
        score: result.score,
      }));
    },
    getTemplateStructure: async () => {
      const templateId = await templateIdFor(userId, projectId);
      if (!templateId) return null;
      const template = await prisma.document.findFirst({
        where: { id: templateId, userId, isTemplate: true, status: "READY" },
        select: { templateStructure: true },
      });
      return template?.templateStructure ?? null;
    },
    getActiveBrd: async ({ brdId: requestedId }) => {
      const brd = await prisma.brdDocument.findFirst({
        where: {
          userId,
          projectId,
          ...((requestedId ?? brdId) ? { id: requestedId ?? brdId } : {}),
        },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      });
      if (!brd) return null;
      return {
        contentMarkdown: brd.contentMarkdown,
        versions: brd.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          contentMarkdown: version.contentMarkdown,
          changeSummary: version.changeSummary,
          createdBy: version.createdBy,
          createdAt: version.createdAt.toISOString(),
        })),
      };
    },
  };
}

/** Template efektif: template project menang, fallback ke setting user. */
async function templateIdFor(userId: string, projectId?: string): Promise<string | null> {
  const [project, settings] = await Promise.all([
    projectId
      ? prisma.project.findFirst({
          where: { id: projectId, userId },
          select: { templateId: true },
        })
      : Promise.resolve(null),
    prisma.userSetting.findUnique({
      where: { userId },
      select: { activeTemplateId: true },
    }),
  ]);
  return project?.templateId ?? settings?.activeTemplateId ?? null;
}

export async function activeTemplateFor(
  userId: string,
  projectId?: string,
): Promise<{
  templateId: string;
  updatedAt: string;
  structure: BrdTemplateStructure;
} | null> {
  const templateId = await templateIdFor(userId, projectId);
  if (!templateId) return null;
  const template = await prisma.document.findFirst({
    where: {
      id: templateId,
      userId,
      isTemplate: true,
      status: "READY",
    },
    select: { id: true, templateStructure: true, updatedAt: true },
  });
  if (!template) return null;
  const structure = normalizeTemplateStructure(template.templateStructure);
  if (!structure) return null;
  return {
    templateId: template.id,
    updatedAt: template.updatedAt.toISOString(),
    structure,
  };
}

/** Resolve router options from the user's saved model settings, dengan fallback env. */
function modelRouterOptionsFor(
  settings: {
    aiProvider: string;
    aiModel: string | null;
    easyModel: string | null;
    mediumModel: string | null;
    hardModel: string | null;
    customBaseUrl: string | null;
    encryptedApiKey: string | null;
  } | null,
) {
  let userApiKey: string | undefined;
  if (settings?.encryptedApiKey) {
    try {
      userApiKey = decryptSecret(settings.encryptedApiKey);
    } catch (error) {
      console.warn(
        "Failed to decrypt user API key; falling back to server key",
        {
          error: error instanceof Error ? error.message : error,
        },
      );
    }
  }
  const provider = settings?.aiProvider ?? "openrouter";
  const baseUrl =
    settings?.customBaseUrl ??
    (provider === "openrouter"
      ? process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1"
      : undefined);
  return {
    apiKey: userApiKey,
    baseUrl,
    defaultModelId: settings?.aiModel ?? undefined,
    easyModelId: settings?.easyModel ?? undefined,
    mediumModelId: settings?.mediumModel ?? undefined,
    hardModelId: settings?.hardModel ?? undefined,
  };
}

export async function agentFor(
  context: { userId: string; projectId: string; sessionId?: string },
  phase: AgentPhase | undefined,
  brdId?: string,
) {
  const { userId, projectId, sessionId } = context;
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  const activeTemplate = await activeTemplateFor(userId, projectId);
  const fingerprint = agentFingerprint(
    userId,
    projectId,
    sessionId,
    settings?.updatedAt?.toISOString(),
    phase,
    brdId,
    activeTemplate?.templateId,
    activeTemplate?.updatedAt,
  );
  const cacheKey = agentCacheKey(userId, sessionId ?? projectId);
  const cached = agentCache.get(cacheKey);
  if (cached?.fingerprint === fingerprint) return cached.agent;
  const agent = createSystemAnalystAgent({
    // Model routing mengikuti settings user; kosong = default env server.
    modelRouter: modelRouterOptionsFor(settings),
    phase,
    contextAdapters: await adaptersFor(userId, projectId, brdId),
    allowedTools: allowedToolsForPhase(phase),
    systemPrompt: settings?.systemPrompt ?? undefined,
    tracingBy: "lens",
    // Flow phases (CLARIFY/JUDGE/GENERATE) are stateless per request and must
    // not pollute the session chat history. Only interactive chat (QA / no
    // phase) is persisted so the transcript stays empty after BRD v1.
    memory:
      phase === undefined || phase === "QA"
        ? { store: memory, savePolicy: "turn" }
        : undefined,
  });

  agentCache.set(cacheKey, { fingerprint, agent });
  if (agentCache.size > 100)
    agentCache.delete(agentCache.keys().next().value as string);
  return agent;
}

export async function distillSessionContext(
  userId: string,
  projectId: string,
): Promise<string> {
  const results = await retrieveDocuments({
    query:
      "requirements business rules actors integrations acceptance criteria",
    topK: 5,
    model: await embeddingModel(),
    store: contextStore,
    filter: vectorFilter.and(
      vectorFilter.eq("userId", userId),
      vectorFilter.eq("projectId", projectId),
    ),
  });
  return results
    .map((result) =>
      typeof result.document === "string"
        ? result.document
        : JSON.stringify(result.document),
    )
    .join("\n")
    .slice(0, 4000);
}

const MAX_ATTACHMENT_CONTEXT_CHARS = 6000;

/**
 * Build a prompt block with the extracted content of documents the user attached
 * or mentioned in the current session, so the agent never has to guess whether
 * OCR/text extraction is available.
 */
export async function attachmentContextBlock(
  userId: string,
  projectId: string,
  documentIds: string[],
): Promise<string> {
  const ids = [
    ...new Set(documentIds.filter((id) => typeof id === "string" && id.trim())),
  ].slice(0, 5);
  if (!ids.length) return "";

  const documents = await prisma.document.findMany({
    where: { id: { in: ids }, userId, projectId },
    select: { id: true, title: true, status: true },
  });
  if (!documents.length) return "";

  const blocks: string[] = [];
  let budget = MAX_ATTACHMENT_CONTEXT_CHARS;
  for (const document of documents) {
    if (
      document.status !== "READY" &&
      document.status !== "PENDING_CONFIRMATION"
    ) {
      blocks.push(
        `### File: ${document.title}\n(status: ${document.status} — masih diproses; beri tahu user untuk menunggu sebentar lalu coba lagi)`,
      );
      continue;
    }
    const pages = await prisma.documentPage.findMany({
      where: { documentId: document.id },
      orderBy: { pageNumber: "asc" },
      select: { pageNumber: true, content: true },
    });
    for (const page of pages) {
      if (budget <= 0) break;
      const content = page.content.trim();
      if (!content) continue;
      const slice = content.slice(0, budget);
      budget -= slice.length;
      blocks.push(
        `### File: ${document.title} (halaman ${page.pageNumber})\n${slice}`,
      );
    }
  }
  if (!blocks.length) return "";

  return [
    "[Konten file sesi yang dirujuk user — jadikan sumber utama, jangan bilang tidak punya akses:",
    blocks.join("\n\n"),
    "Gunakan search_context bila butuh bagian lain dari file tersebut.]",
  ].join("\n");
}
