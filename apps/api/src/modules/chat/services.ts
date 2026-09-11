import {
  applyChange,
  buildClarificationQuestions,
  clarificationGateHeuristically,
  classifyWorkflowHeuristically,
  createBrdDraft,
  createSystemAnalystAgent,
  distillContext,
  type AgentContextAdapters,
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
import type { AgentPhase, FlowRequest } from "./types.js";

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

export async function agentFor(
  userId: string,
  sessionId: string,
  phase: AgentPhase | undefined,
  brdId?: string,
) {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  const fingerprint = agentFingerprint(
    userId,
    sessionId,
    settings?.updatedAt?.toISOString(),
    phase,
    brdId,
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
    systemPrompt: settings?.systemPrompt ?? undefined,
    contextAdapters: await adaptersFor(userId, sessionId, brdId),
    memory: { store: memory, savePolicy: "turn" },
    enableTracing: false,
  });
  agentCache.set(cacheKey, { fingerprint, agent });
  if (agentCache.size > 100) agentCache.delete(agentCache.keys().next().value as string);
  return agent;
}

export async function distillSessionContext(
  userId: string,
  sessionId: string,
  query: string,
): Promise<string> {
  try {
    const adapters = await adaptersFor(userId, sessionId);
    const context = adapters.searchContext
      ? await adapters.searchContext({
          query,
          filters: { userId, sessionId },
          topK: 5,
        })
      : [];
    return distillContext(context, { topK: 5, maxChars: 4000 });
  } catch {
    // The generation flow must remain usable before a Qdrant collection exists
    // or when this session has no indexed references yet.
    return "";
  }
}

export type ClarificationQuestion = {
  id: string;
  question: string;
  options: string[];
  required: boolean;
};

export type FlowResult =
  | {
      phase: "CLARIFYING";
      round: number;
      clarification_questions: ClarificationQuestion[];
      missing: string[];
    }
  | {
      phase: "GENERATING";
      round: number;
      markdown: string;
      assumptions: string[];
      traceability: Array<
        | { source: "userStory" | "document"; target: "BR-001" }
        | { source: "clarification"; id: string; target: "FR-001" }
      >;
      context: string;
    };

export async function runBrdFlow(
  userId: string,
  sessionId: string,
  request: FlowRequest,
): Promise<FlowResult | { error: string }> {
  const userStory = request.userStory?.trim();
  if (!userStory) return { error: "A user story is required" };

  const answers = request.answers ?? {};
  const round = Math.min(Math.max(request.round ?? 1, 1), 2);
  const referenceContext = request.referenceContext?.trim() ?? "";
  const operation = classifyWorkflowHeuristically(`draft BRD: ${userStory}`);

  if (operation.operation !== "draft") {
    return { error: "Only BRD drafting is supported by this flow" };
  }

  const answerValues = Object.values(answers);
  const gate = clarificationGateHeuristically(userStory, answerValues, round);
  if (!gate.sufficient && round < 2 && !referenceContext) {
    return {
      phase: "CLARIFYING",
      round,
      clarification_questions: buildClarificationQuestions(userStory, round),
      missing: gate.missing,
    };
  }

  const draft = createBrdDraft(
    userStory,
    Object.entries(answers).map(([id, answer]) => ({ id, answer })),
    undefined,
    referenceContext,
  );

  return {
    phase: "GENERATING",
    round,
    markdown: draft.markdown,
    assumptions: draft.assumptions,
    traceability: [
      { source: "userStory", target: "BR-001" },
      ...Object.keys(answers).map((id) => ({
        source: "clarification" as const,
        id,
        target: "FR-001" as const,
      })),
      ...(referenceContext ? [{ source: "document" as const, target: "BR-001" as const }] : []),
    ],
    context: await distillSessionContext(userId, sessionId, userStory),
  };
}

export function clarifyFor(userStory: string, round = 1): ClarificationQuestion[] {
  return buildClarificationQuestions(userStory, round);
}

export function modifyBrd(brd: string, changeRequest: string, referenceContext?: string) {
  const result = applyChange(brd, changeRequest);
  return {
    updatedMarkdown: result.markdown,
    changeSummary: `Applied requested BRD change for ${result.affectedIds.join(", ") || "the document"}.`,
    affectedIds: result.affectedIds,
    groundedByReference: Boolean(referenceContext?.trim()),
    persisted: false,
  };
}
