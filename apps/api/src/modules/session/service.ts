import { randomUUID } from "node:crypto";
import { createMemoryScopeKey } from "@anvia/core/memory";
import type { Message } from "@anvia/core/completion";
import { messagesToUIMessages } from "@anvia/client";
import type { UIMessage } from "@anvia/client";
import { prisma } from "../../lib/prisma.js";
import { deleteDocument, deleteDocumentVectors } from "../document/services.js";
import { DEFAULT_TITLE, TITLE_MAX_LENGTH, titleFromContent } from "./utils.js";

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

export function scopeKey(sessionId: string, userId: string): string {
  return createMemoryScopeKey({
    scope: { sessionId, userId, metadata: { userId } },
    metadataKeys: ["userId"],
  });
}

export { titleFromContent } from "./utils.js";

export async function listSessions(userId: string): Promise<SessionSummary[]> {
  const rows = await prisma.agentMemorySession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return rows.map((row) => ({
    id: row.sessionId,
    title: row.title ?? DEFAULT_TITLE,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: row._count.messages,
  }));
}

export async function createSession(
  userId: string,
  initialTitle?: string,
  options: { projectId?: string } = {},
): Promise<SessionSummary> {
  const sessionId = randomUUID();
  const title = initialTitle?.trim() || DEFAULT_TITLE;
  const key = scopeKey(sessionId, userId);

  const row = await prisma.agentMemorySession.upsert({
    where: { scopeKey: key },
    update: { title },
    create: {
      scopeKey: key,
      sessionId,
      userId,
      title,
      projectId: options.projectId,
      metadata: { userId },
    },
  });

  return {
    id: row.sessionId,
    title: row.title ?? DEFAULT_TITLE,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount: 0,
  };
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: { title?: string; projectId?: string | null },
): Promise<SessionSummary | null> {
  const session = await prisma.agentMemorySession.findFirst({ where: { sessionId, userId } });
  if (!session) return null;
  const updated = await prisma.agentMemorySession.update({
    where: { id: session.id },
    data: {
      ...(input.title?.trim() ? { title: input.title.trim().slice(0, TITLE_MAX_LENGTH) } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    },
  });
  const messageCount = await prisma.agentMemoryMessage.count({
    where: { memorySessionId: updated.id },
  });
  return {
    id: updated.sessionId,
    title: updated.title ?? DEFAULT_TITLE,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    messageCount,
  };
}

export async function renameSession(
  userId: string,
  sessionId: string,
  title: string,
): Promise<SessionSummary | null> {
  const clean = title.trim();
  if (!clean) return null;

  const row = await prisma.agentMemorySession.updateMany({
    where: { sessionId, userId },
    data: { title: clean.slice(0, TITLE_MAX_LENGTH) },
  });

  if (row.count === 0) return null;

  const updated = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    include: { _count: { select: { messages: true } } },
  });

  if (!updated) return null;
  return {
    id: updated.sessionId,
    title: updated.title ?? DEFAULT_TITLE,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    messageCount: updated._count.messages,
  };
}

export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    select: { id: true },
  });
  if (!session) return false;

  const documents = await prisma.document.findMany({
    where: { sessionId, userId },
    select: { id: true, objectKey: true },
  });

  // Best-effort storage cleanup first: DB rows are removed afterwards, so a
  // failed cleanup never loses the object keys needed to retry it.
  await Promise.all(
    documents.flatMap((document) => [
      deleteDocumentVectors(document.id).catch((error: unknown) =>
        console.warn("Failed to delete session document vectors", {
          documentId: document.id,
          error: error instanceof Error ? error.message : error,
        }),
      ),
      deleteDocument(document.objectKey).catch((error: unknown) =>
        console.warn("Failed to delete session document object", {
          documentId: document.id,
          error: error instanceof Error ? error.message : error,
        }),
      ),
    ]),
  );

  await prisma.$transaction([
    prisma.document.deleteMany({ where: { sessionId, userId } }),
    prisma.brdDocument.deleteMany({ where: { sessionId, userId } }),
    prisma.brdFlowState.deleteMany({ where: { sessionId, userId } }),
    prisma.agentMemoryMessage.deleteMany({ where: { memorySessionId: session.id } }),
    prisma.agentMemorySession.delete({ where: { id: session.id } }),
  ]);
  return true;
}

export async function getSessionMessages(userId: string, sessionId: string): Promise<UIMessage[]> {
  const session = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    select: { id: true },
  });
  if (!session) return [];

  const rows = await prisma.agentMemoryMessage.findMany({
    where: { memorySessionId: session.id },
    orderBy: { position: "asc" },
  });

  if (rows.length === 0) return [];
  const messages = rows.map((row) => row.message as unknown as Message);
  return messagesToUIMessages(messages);
}

export async function titleSessionFromFirstMessage(
  userId: string,
  sessionId: string,
  content: unknown,
): Promise<void> {
  const title = titleFromContent(content);
  if (!title) return;

  await prisma.agentMemorySession.updateMany({
    where: { sessionId, userId, OR: [{ title: null }, { title: "" }, { title: DEFAULT_TITLE }] },
    data: { title },
  });
}
