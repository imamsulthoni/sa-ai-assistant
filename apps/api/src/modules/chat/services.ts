import {
  createSystemAnalystAgent,
  normalizeTemplateStructure,
  templateInstructionBlock,
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
          vectorFilter.eq("userId", filters.userId),
          vectorFilter.eq("sessionId", filters.sessionId),
        ),
      });
      return results.map((result) => ({
        documentId: String(result.metadata?.documentId ?? result.id),
        pageNumber:
          typeof result.metadata?.pageNumber === "number" ? result.metadata.pageNumber : null,
        content:
          typeof result.document === "string" ? result.document : JSON.stringify(result.document),
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
      return brd ? { contentMarkdown: brd.contentMarkdown, versions: brd.versions } : null;
    },
  };
}

async function activeTemplateFor(
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
    allowedTools:
      phase === "CLARIFY"
        ? ["elicit_clarifications", "search_context", "get_active_brd", "web_search"]
        : phase === "GENERATE"
          ? ["draft_brd", "search_context", "get_template_structure", "get_active_brd", "web_search"]
          : phase === "QA"
            ? ["answer_brd_question", "modify_brd", "search_context", "get_active_brd", "web_search"]
            : undefined,
    systemPrompt: settings?.systemPrompt ?? undefined,
    memory: { store: memory, savePolicy: "turn" },
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


