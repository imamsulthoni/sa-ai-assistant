import { randomUUID } from "node:crypto";
import { createMemoryScopeKey } from "@anvia/core/memory";
import type { Message } from "@anvia/core/completion";
import { messagesToUIMessages } from "@anvia/client";
import type { UIMessage } from "@anvia/client";
import { prisma } from "../../lib/prisma.js";

const DEFAULT_TITLE = "New chat";
const TITLE_MAX_LENGTH = 60;

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

export function titleFromContent(content: unknown): string | null {
  const text = extractText(content);
  if (!text) return null;
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) return null;
  return singleLine.length > TITLE_MAX_LENGTH
    ? `${singleLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : singleLine;
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && "text" in part
        ? String((part as { text: unknown }).text ?? "")
        : "",
    )
    .join(" ")
    .trim();
}

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
  options: { projectId?: string; templateId?: string } = {},
): Promise<SessionSummary> {
  const sessionId = randomUUID();
  const title = initialTitle?.trim() || DEFAULT_TITLE;
  const key = scopeKey(sessionId, userId);

  const metadata = {
    userId,
    ...(options.templateId ? { templateId: options.templateId } : {}),
  };
  const row = await prisma.agentMemorySession.upsert({
    where: { scopeKey: key },
    update: { title },
    create: {
      scopeKey: key,
      sessionId,
      userId,
      title,
       projectId: options.projectId,
       metadata,
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
  input: { title?: string; projectId?: string | null; templateId?: string | null },
): Promise<SessionSummary | null> {
  const session = await prisma.agentMemorySession.findFirst({ where: { sessionId, userId } });
  if (!session) return null;
  if (input.templateId) {
    const template = await prisma.document.findFirst({
      where: { id: input.templateId, userId, isTemplate: true, status: "READY" },
      select: { id: true },
    });
    if (!template) throw new Error("Template not found or not approved");
  }
  const currentMetadata = (session.metadata as Record<string, unknown> | null) ?? { userId };
  const metadata: Record<string, unknown> = { ...currentMetadata, userId };
  if (input.templateId === null) delete metadata.templateId;
  if (input.templateId) metadata.templateId = input.templateId;
  const updated = await prisma.agentMemorySession.update({
    where: { id: session.id },
    data: {
      ...(input.title?.trim() ? { title: input.title.trim().slice(0, TITLE_MAX_LENGTH) } : {}),
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      metadata: metadata as unknown as { userId: string; templateId?: string },
    },
  });
  const messageCount = await prisma.agentMemoryMessage.count({ where: { memorySessionId: updated.id } });
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

  await prisma.$transaction([
    prisma.document.deleteMany({
      where: { sessionId, userId },
    }),
    prisma.agentMemoryMessage.deleteMany({
      where: { memorySessionId: session.id },
    }),
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
