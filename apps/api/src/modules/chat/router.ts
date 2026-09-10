import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import { agentToClientStream, parseClientStreamRequest } from "@anvia/client";
import { createSystemAnalystAgent, type AgentContextAdapters } from "@sa-ai-assistant/agent";
import { PrismaMemoryStore } from "@anvia/memory-prisma";
import { prisma } from "../../lib/prisma.js";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { titleSessionFromFirstMessage } from "../session/service.js";
import { decryptSecret } from "../../lib/crypto.js";
import { retrieveDocuments, vectorFilter } from "@anvia/core/vector-store";
import { QdrantVectorClient } from "@anvia/qdrant";
import {
  loadTransformersEmbeddingModel,
  DEFAULT_TRANSFORMERS_EMBEDDING_MODEL,
} from "@anvia/transformers";

type CachedAgent = { fingerprint: string; agent: ReturnType<typeof createSystemAnalystAgent> };
const agentCache = new Map<string, CachedAgent>();

export const chatModule = new Hono();

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

function embeddingModel() {
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

async function agentFor(
  userId: string,
  sessionId: string,
  phase: "CLARIFY" | "GENERATE" | "QA" | undefined,
  brdId?: string,
) {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  const apiKey = settings?.encryptedApiKey ? decryptSecret(settings.encryptedApiKey) : undefined;
  const fingerprint = JSON.stringify([settings?.updatedAt.toISOString(), phase, brdId]);
  const cached = agentCache.get(userId);
  if (cached?.fingerprint === fingerprint) return cached.agent;
  const agent = createSystemAnalystAgent({
    modelId: settings?.aiModel,
    apiKey,
    baseUrl: settings?.customBaseUrl ?? undefined,
    phase,
    systemPrompt: settings?.systemPrompt ?? undefined,
    contextAdapters: await adaptersFor(userId, sessionId, brdId),
    memory: { store: memory, savePolicy: "turn" },
    enableTracing: false,
  });
  agentCache.set(userId, { fingerprint, agent });
  if (agentCache.size > 100) agentCache.delete(agentCache.keys().next().value as string);
  return agent;
}

chatModule.post("/", async (c) => {
  const body = parseClientStreamRequest(await c.req.json());

  if (body.type !== "messages") {
    return c.json({ error: "Only message streams are supported" }, 400);
  }

  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();

  if (!sessionId) {
    return c.json({ error: "A conversation id is required" }, 400);
  }

  const latest = body.messages.at(-1);

  if (!latest || latest.role !== "user") {
    return c.json({ error: "A user message is required" }, 400);
  }

  await titleSessionFromFirstMessage(userId, sessionId, latest.content);

  const metadata = body.metadata as
    | { phase?: "CLARIFY" | "GENERATE" | "QA"; brdDocumentId?: string }
    | undefined;
  const agent = await agentFor(userId, sessionId, metadata?.phase, metadata?.brdDocumentId);

  const agentStream = agent.stream({
    prompt: { role: "user", content: latest.content },
    session: {
      sessionId,
      userId,
      metadata: { userId },
    },
  });

  const events = agentToClientStream({
    events: agentStream,
    ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
    mapError: () => ({ message: "The run failed", retryable: true }),
  });

  return createClientStreamResponse({ events });
});
