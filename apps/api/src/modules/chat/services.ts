import {
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
import { agentCacheKey, agentFingerprint } from "./utils.js";
import type { AgentPhase } from "./types.js";

type CachedAgent = { fingerprint: string; agent: ReturnType<typeof createSystemAnalystAgent> };
const agentCache = new Map<string, CachedAgent>();

const memory = new PrismaMemoryStore({
  client: prisma,
  scopeKey: { metadataKeys: ["userId"] },
});

const qdrant = new QdrantVectorClient({ url: process.env.QDRANT_URL ?? "http://127.0.0.1:6333" });
const contextStore = qdrant.vectorStore({
  collectionName: "documents",
  dimensions: 384,
  metric: "cosine",
});
let contextEmbeddingModel: ReturnType<typeof loadTransformersEmbeddingModel> | undefined;

async function embeddingModel() {
  contextEmbeddingModel ??= loadTransformersEmbeddingModel({
    modelId: DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
  });
  return contextEmbeddingModel;
}

async function adaptersFor(
  userId: string,
  sessionId: string,
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
          vectorFilter.eq("sessionId", filters.sessionId ?? sessionId),
        ),
      });
      return results.map((result) => ({
        documentId: String(result.metadata?.documentId ?? result.id),
        title:
          typeof result.metadata?.documentName === "string" ? result.metadata.documentName : null,
        pageNumber:
          typeof result.metadata?.pageNumber === "number" ? result.metadata.pageNumber : null,
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
      const session = await prisma.agentMemorySession.findFirst({
        where: { sessionId, userId },
        select: { projectId: true, metadata: true },
      });
      const metadata = session?.metadata as { templateId?: string } | null;
      const settings = await prisma.userSetting.findUnique({
        where: { userId },
        select: { activeTemplateId: true },
      });
      const project = session?.projectId
        ? await prisma.project.findUnique({
            where: { id: session.projectId },
            select: { templateId: true },
          })
        : null;
      const templateId = metadata?.templateId ?? project?.templateId ?? settings?.activeTemplateId;
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
          sessionId,
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

export async function activeTemplateFor(
  userId: string,
): Promise<{ templateId: string; updatedAt: string; structure: BrdTemplateStructure } | null> {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  if (!settings?.activeTemplateId) return null;
  const template = await prisma.document.findFirst({
    where: { id: settings.activeTemplateId, userId, isTemplate: true, status: "READY" },
    select: { id: true, templateStructure: true, updatedAt: true },
  });
  if (!template) return null;
  const structure = normalizeTemplateStructure(template.templateStructure);
  if (!structure) return null;
  return { templateId: template.id, updatedAt: template.updatedAt.toISOString(), structure };
}

export async function agentFor(
  userId: string,
  sessionId: string,
  phase: AgentPhase | undefined,
  brdId?: string,
) {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  const activeTemplate = await activeTemplateFor(userId);
  const fingerprint = agentFingerprint(
    userId,
    sessionId,
    settings?.updatedAt?.toISOString(),
    phase,
    brdId,
    activeTemplate?.templateId,
    activeTemplate?.updatedAt,
  );
  const cacheKey = agentCacheKey(userId, sessionId);
  const cached = agentCache.get(cacheKey);
  if (cached?.fingerprint === fingerprint) return cached.agent;
  const agent = createSystemAnalystAgent({
    // PRD §4H: provider/model/baseUrl/credentials are server-managed via env
    // (the agent package falls back to OPENAI_* env vars); never per-user.
    modelId: undefined,
    apiKey: undefined,
    baseUrl: undefined,
    phase,
    contextAdapters: await adaptersFor(userId, sessionId, brdId),
    allowedTools:
      phase === "CLARIFY"
        ? ["elicit_clarifications", "search_context", "get_active_brd", "web_search"]
        : phase === "GENERATE"
          ? ["draft_brd", "search_context", "get_template_structure", "get_active_brd", "web_search"]
          : phase === "QA"
            ? ["answer_brd_question", "modify_brd", "search_context", "get_active_brd", "web_search", "verify_flowchart"]
            : undefined,
    systemPrompt: settings?.systemPrompt ?? undefined,
    // Flow phases (CLARIFY/JUDGE/GENERATE) are stateless per request and must
    // not pollute the session chat history. Only interactive chat (QA / no
    // phase) is persisted so the transcript stays empty after BRD v1.
    memory:
      phase === undefined || phase === "QA"
        ? { store: memory, savePolicy: "turn" }
        : undefined,
    enableTracing: false,
  });

  agentCache.set(cacheKey, { fingerprint, agent });
  if (agentCache.size > 100) agentCache.delete(agentCache.keys().next().value as string);
  return agent;
}

export async function distillSessionContext(userId: string, sessionId: string): Promise<string> {
  const results = await retrieveDocuments({
    query: "requirements business rules actors integrations acceptance criteria",
    topK: 5,
    model: await embeddingModel(),
    store: contextStore,
    filter: vectorFilter.and(vectorFilter.eq("userId", userId), vectorFilter.eq("sessionId", sessionId)),
  });
  return results.map((result) => typeof result.document === "string" ? result.document : JSON.stringify(result.document)).join("\n").slice(0, 4000);
}

const MAX_ATTACHMENT_CONTEXT_CHARS = 6000;

/**
 * Build a prompt block with the extracted content of documents the user attached
 * or mentioned in the current session, so the agent never has to guess whether
 * OCR/text extraction is available.
 */
export async function attachmentContextBlock(
  userId: string,
  sessionId: string,
  documentIds: string[],
): Promise<string> {
  const ids = [...new Set(documentIds.filter((id) => typeof id === "string" && id.trim()))].slice(0, 5);
  if (!ids.length) return "";

  const documents = await prisma.document.findMany({
    where: { id: { in: ids }, userId, sessionId },
    select: { id: true, title: true, status: true },
  });
  if (!documents.length) return "";

  const blocks: string[] = [];
  let budget = MAX_ATTACHMENT_CONTEXT_CHARS;
  for (const document of documents) {
    if (document.status !== "READY" && document.status !== "PENDING_CONFIRMATION") {
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
      blocks.push(`### File: ${document.title} (halaman ${page.pageNumber})\n${slice}`);
    }
  }
  if (!blocks.length) return "";

  return [
    "[Konten file sesi yang dirujuk user — jadikan sumber utama, jangan bilang tidak punya akses:",
    blocks.join("\n\n"),
    "Gunakan search_context bila butuh bagian lain dari file tersebut.]",
  ].join("\n");
}


