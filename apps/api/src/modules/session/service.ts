import { randomUUID } from "node:crypto";
import { createMemoryScopeKey } from "@anvia/core/memory";
import type { Message } from "@anvia/core/completion";
import { messagesToUIMessages } from "@anvia/client";
import type { UIMessage } from "@anvia/client";
import { prisma } from "../../lib/prisma.js";
import { DEFAULT_TITLE, TITLE_MAX_LENGTH, titleFromContent } from "./utils.js";

export type SessionBrdSummary = {
  id: string;
  currentVersion: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
  hasPendingModification: boolean;
};

export type SessionFlowSummary = {
  phase: "CLARIFYING" | "GENERATING";
  round: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  brd: SessionBrdSummary | null;
  flow: SessionFlowSummary | null;
};

type SessionStatusMaps = {
  brds: Map<string, SessionBrdSummary>;
  flows: Map<string, SessionFlowSummary>;
};

/** Ringkasan BRD + flow per project (satu query batch) untuk badge sidebar. */
async function sessionStatusMaps(projectIds: string[]): Promise<SessionStatusMaps> {
  const brds = new Map<string, SessionBrdSummary>();
  const flows = new Map<string, SessionFlowSummary>();
  const unique = [...new Set(projectIds.filter(Boolean))];
  if (unique.length === 0) return { brds, flows };

  const brdRows = await prisma.brdDocument.findMany({
    where: { projectId: { in: unique } },
    select: {
      id: true,
      projectId: true,
      currentVersion: true,
      status: true,
      pendingContentMarkdown: true,
    },
  });
  const flowRows = await prisma.brdFlowState.findMany({
    where: { projectId: { in: unique }, phase: { not: null } },
    select: { projectId: true, phase: true, round: true },
  });

  for (const row of brdRows) {
    brds.set(row.projectId, {
      id: row.id,
      currentVersion: row.currentVersion,
      status: row.status,
      hasPendingModification: Boolean(row.pendingContentMarkdown),
    });
  }
  for (const row of flowRows) {
    if (!row.phase) continue;
    flows.set(row.projectId, { phase: row.phase, round: row.round });
  }

  return { brds, flows };
}

export function scopeKey(sessionId: string, userId: string): string {
  return createMemoryScopeKey({
    scope: { sessionId, userId, metadata: { userId } },
    metadataKeys: ["userId"],
  });
}

export { titleFromContent } from "./utils.js";

type SessionRow = {
  sessionId: string;
  title: string | null;
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type SessionRowWithCount = SessionRow & {
  _count?: { messages: number };
  project?: { id: string; name: string } | null;
};

function toSessionSummary(
  row: SessionRowWithCount,
  messageCount: number,
  maps: SessionStatusMaps,
): SessionSummary {
  return {
    id: row.sessionId,
    title: row.title ?? DEFAULT_TITLE,
    projectId: row.projectId,
    projectName: row.project?.name ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messageCount,
    brd: (row.projectId ? maps.brds.get(row.projectId) : null) ?? null,
    flow: (row.projectId ? maps.flows.get(row.projectId) : null) ?? null,
  };
}

export async function listSessions(userId: string, projectId?: string): Promise<SessionSummary[]> {
  const rows = await prisma.agentMemorySession.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
      project: { select: { id: true, name: true } },
    },
  });

  const { brds, flows } = await sessionStatusMaps(rows.map((row) => row.projectId ?? ""));
  const maps = { brds, flows };

  return rows.map((row) => toSessionSummary(row, row._count.messages, maps));
}

async function ownedProject(userId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, name: true },
  });
}

export async function createSession(
  userId: string,
  initialTitle: string | undefined,
  projectId: string,
): Promise<SessionSummary> {
  const project = await ownedProject(userId, projectId);
  if (!project) throw new Error("Project not found");

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
      projectId: project.id,
      metadata: { userId },
    },
  });

  return toSessionSummary(
    { ...row, project: { id: project.id, name: project.name } },
    0,
    { brds: new Map(), flows: new Map() },
  );
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: { title?: string; projectId?: string },
): Promise<SessionSummary | null> {
  const session = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!session) return null;

  let project = session.project;
  if (input.projectId !== undefined && input.projectId !== session.projectId) {
    project = await ownedProject(userId, input.projectId);
    if (!project) throw new Error("Project not found");
  }

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
  const { brds, flows } = await sessionStatusMaps([updated.projectId ?? ""]);
  return toSessionSummary(
    { ...updated, project: project ?? null },
    messageCount,
    { brds, flows },
  );
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
    include: {
      _count: { select: { messages: true } },
      project: { select: { id: true, name: true } },
    },
  });

  if (!updated) return null;
  const { brds, flows } = await sessionStatusMaps([updated.projectId ?? ""]);
  return toSessionSummary(updated, updated._count.messages, { brds, flows });
}

/** Project id milik sebuah sesi; null bila sesi tidak ada atau tanpa project. */
export async function sessionProjectId(
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const row = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    select: { projectId: true },
  });
  return row?.projectId ?? null;
}

/**
 * Menghapus satu sesi percakapan. Project beserta BRD dan dokumennya tidak
 * tersentuh: sesi hanyalah unit percakapan, bukan pemilik knowledge base.
 */
export async function deleteSession(userId: string, sessionId: string): Promise<boolean> {
  const session = await prisma.agentMemorySession.findFirst({
    where: { sessionId, userId },
    select: { id: true },
  });
  if (!session) return false;

  await prisma.$transaction([
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
