import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/** A crashed generation claim is stealable after this window. */
export const GENERATION_LOCK_TTL_MS = 5 * 60_000;

export type BrdFlowContext = { userId: string; sessionId: string };

export type BrdFlowCheckpoint = {
  phase: "CLARIFYING" | "GENERATING" | null;
  userStory: string | null;
  round: number;
  questions: unknown[];
  answers: Record<string, string>;
  pendingImportDocumentId: string | null;
};

const key = (context: BrdFlowContext) => ({
  userId: context.userId,
  sessionId: context.sessionId,
});

function asQuestions(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

export async function getBrdFlow(context: BrdFlowContext): Promise<BrdFlowCheckpoint | null> {
  const flow = await prisma.brdFlowState.findUnique({
    where: { userId_sessionId: key(context) },
  });
  if (!flow) return null;
  return {
    phase: flow.phase,
    userStory: flow.userStory,
    round: flow.round,
    questions: asQuestions(flow.questions),
    answers: asAnswers(flow.answers),
    pendingImportDocumentId: flow.pendingImportDocumentId,
  };
}

/**
 * Simpan checkpoint clarify (round + pertanyaan + jawaban yang sudah masuk).
 * Fresh generation lock tidak boleh dibatalkan oleh checkpoint baru dari tab
 * yang masih menampilkan state lama.
 */
export async function saveClarifyCheckpoint(
  context: BrdFlowContext,
  input: { userStory: string; round: number; questions: unknown; answers: Record<string, string> },
): Promise<void> {
  const data = {
    phase: "CLARIFYING" as const,
    userStory: input.userStory,
    round: input.round,
    questions: input.questions as Prisma.InputJsonValue,
    answers: input.answers as Prisma.InputJsonValue,
    generatingSince: null,
  };
  const updated = await prisma.brdFlowState.updateMany({
    where: {
      ...key(context),
      NOT: {
        phase: "GENERATING",
        generatingSince: { gt: new Date(Date.now() - GENERATION_LOCK_TTL_MS) },
      },
    },
    data,
  });
  if (updated.count > 0) return;

  const existing = await prisma.brdFlowState.findUnique({
    where: { userId_sessionId: key(context) },
    select: { id: true },
  });
  if (existing) return; // a fresh generation owns this flow; leave it untouched

  await prisma.brdFlowState.create({ data: { ...key(context), ...data } });
}

/** Pastikan row checkpoint ada untuk jalur yang tidak melewati clarifyFlow. */
export async function ensureBrdFlow(
  context: BrdFlowContext,
  input: { userStory?: string; round?: number; answers?: Record<string, string> },
): Promise<void> {
  await prisma.brdFlowState.upsert({
    where: { userId_sessionId: key(context) },
    create: {
      ...key(context),
      userStory: input.userStory ?? null,
      round: input.round ?? 1,
      answers: (input.answers ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      ...(input.userStory !== undefined ? { userStory: input.userStory } : {}),
      ...(input.round !== undefined ? { round: input.round } : {}),
      ...(input.answers !== undefined ? { answers: input.answers as Prisma.InputJsonValue } : {}),
    },
  });
}

/** Klaim lock generasi; false berarti ada generasi lain yang masih segar. */
export async function claimGeneration(context: BrdFlowContext): Promise<boolean> {
  const claimed = await prisma.brdFlowState.updateMany({
    where: {
      ...key(context),
      OR: [
        { generatingSince: null },
        { generatingSince: { lt: new Date(Date.now() - GENERATION_LOCK_TTL_MS) } },
      ],
    },
    data: { phase: "GENERATING", generatingSince: new Date() },
  });
  return claimed.count > 0;
}

export async function releaseGeneration(context: BrdFlowContext): Promise<void> {
  await prisma.brdFlowState.updateMany({
    where: key(context),
    data: { generatingSince: null },
  });
}

export async function deleteBrdFlow(context: BrdFlowContext): Promise<void> {
  await prisma.brdFlowState.deleteMany({ where: key(context) });
}

export async function markPendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<void> {
  await prisma.brdFlowState.upsert({
    where: { userId_sessionId: key(context) },
    create: { ...key(context), pendingImportDocumentId: documentId },
    update: { pendingImportDocumentId: documentId },
  });
}

export async function clearPendingImport(context: BrdFlowContext): Promise<void> {
  await prisma.brdFlowState.updateMany({
    where: key(context),
    data: { pendingImportDocumentId: null },
  });
}

/** Klaim atomik: hanya satu request yang boleh memproses import dokumen yang sama. */
export async function claimPendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<boolean> {
  const claimed = await prisma.brdFlowState.updateMany({
    where: { ...key(context), pendingImportDocumentId: documentId },
    data: { pendingImportDocumentId: null },
  });
  return claimed.count > 0;
}

export async function restorePendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<void> {
  await prisma.brdFlowState.updateMany({
    where: key(context),
    data: { pendingImportDocumentId: documentId },
  });
}
