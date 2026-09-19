import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/** A crashed generation claim is stealable after this window. */
export const GENERATION_LOCK_TTL_MS = 5 * 60_000;

/**
 * Alur BRD dimiliki project: semua sesi dalam project yang sama berbagi
 * checkpoint klarifikasi, lock generasi, dan pointer import yang sama.
 */
export type BrdFlowContext = { userId: string; projectId: string; sessionId?: string };

export type BrdFlowCheckpoint = {
  phase: "CLARIFYING" | "GENERATING" | null;
  userStory: string | null;
  round: number;
  questions: unknown[];
  answers: Record<string, string>;
  pendingImportDocumentId: string | null;
};

function asQuestions(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, string>;
}

export async function getBrdFlow(context: BrdFlowContext): Promise<BrdFlowCheckpoint | null> {
  const flow = await prisma.brdFlowState.findUnique({
    where: { projectId: context.projectId },
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
 * Tulis checkpoint dengan guard: fresh generation lock tidak boleh dibatalkan
 * oleh checkpoint baru dari tab yang masih menampilkan state lama.
 */
async function writeClarifyCheckpoint(
  context: BrdFlowContext,
  data: {
    userStory: string;
    round: number;
    answers: Record<string, string>;
    questions?: unknown;
  },
): Promise<void> {
  const fields = {
    userId: context.userId,
    ...(context.sessionId ? { sessionId: context.sessionId } : {}),
    phase: "CLARIFYING" as const,
    userStory: data.userStory,
    round: data.round,
    answers: data.answers as Prisma.InputJsonValue,
    generatingSince: null,
  };
  const updated = await prisma.brdFlowState.updateMany({
    where: {
      projectId: context.projectId,
      NOT: {
        phase: "GENERATING",
        generatingSince: { gt: new Date(Date.now() - GENERATION_LOCK_TTL_MS) },
      },
    },
    data:
      data.questions === undefined
        ? fields
        : { ...fields, questions: data.questions as Prisma.InputJsonValue },
  });
  if (updated.count > 0) return;

  const existing = await prisma.brdFlowState.findUnique({
    where: { projectId: context.projectId },
    select: { id: true },
  });
  if (existing) return; // a fresh generation owns this flow; leave it untouched

  await prisma.brdFlowState.create({
    data: {
      projectId: context.projectId,
      ...(data.questions === undefined
        ? fields
        : { ...fields, questions: data.questions as Prisma.InputJsonValue }),
    },
  });
}

/**
 * Simpan checkpoint clarify (round + pertanyaan + jawaban yang sudah masuk).
 */
export async function saveClarifyCheckpoint(
  context: BrdFlowContext,
  input: { userStory: string; round: number; questions: unknown; answers: Record<string, string> },
): Promise<void> {
  await writeClarifyCheckpoint(context, input);
}

/**
 * Tandai bahwa klarifikasi sedang berjalan (agen belum mengembalikan pertanyaan).
 * Reload di tengah request harus tetap berada di fase klarifikasi, bukan sesi kosong.
 * Pertanyaan lama sengaja tidak dihapus agar retry tidak kehilangan konteks.
 */
export async function markClarifyStarted(
  context: BrdFlowContext,
  input: { userStory: string; round: number; answers: Record<string, string> },
): Promise<void> {
  await writeClarifyCheckpoint(context, input);
}

/** Pastikan row checkpoint ada untuk jalur yang tidak melewati clarifyFlow. */
export async function ensureBrdFlow(
  context: BrdFlowContext,
  input: { userStory?: string; round?: number; answers?: Record<string, string> },
): Promise<void> {
  const projectId = context.projectId;
  await prisma.brdFlowState.upsert({
    where: { projectId },
    create: {
      projectId,
      userId: context.userId,
      sessionId: context.sessionId,
      userStory: input.userStory ?? null,
      round: input.round ?? 1,
      answers: (input.answers ?? {}) as Prisma.InputJsonValue,
    },
    update: {
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
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
      projectId: context.projectId,
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
    where: { projectId: context.projectId },
    data: { generatingSince: null },
  });
}

export async function deleteBrdFlow(context: BrdFlowContext): Promise<void> {
  await prisma.brdFlowState.deleteMany({ where: { projectId: context.projectId } });
}

export async function markPendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<void> {
  await prisma.brdFlowState.upsert({
    where: { projectId: context.projectId },
    create: {
      projectId: context.projectId,
      userId: context.userId,
      sessionId: context.sessionId,
      pendingImportDocumentId: documentId,
    },
    update: {
      ...(context.sessionId ? { sessionId: context.sessionId } : {}),
      pendingImportDocumentId: documentId,
    },
  });
}

export async function clearPendingImport(context: BrdFlowContext): Promise<void> {
  await prisma.brdFlowState.updateMany({
    where: { projectId: context.projectId },
    data: { pendingImportDocumentId: null },
  });
}

/** Klaim atomik: hanya satu request yang boleh memproses import dokumen yang sama. */
export async function claimPendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<boolean> {
  const claimed = await prisma.brdFlowState.updateMany({
    where: { projectId: context.projectId, pendingImportDocumentId: documentId },
    data: { pendingImportDocumentId: null },
  });
  return claimed.count > 0;
}

export async function restorePendingImport(
  context: BrdFlowContext,
  documentId: string,
): Promise<void> {
  await prisma.brdFlowState.updateMany({
    where: { projectId: context.projectId },
    data: { pendingImportDocumentId: documentId },
  });
}
