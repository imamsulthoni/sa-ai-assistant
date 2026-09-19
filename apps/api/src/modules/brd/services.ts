import { prisma } from "../../lib/prisma.js";
import type { BrdDocument } from "../../generated/prisma/client.js";
import type {
  BrdCreateInput,
  BrdImportInput,
  BrdVersionCreateInput,
} from "../../lib/api-contract.js";
import {
  claimGeneration,
  claimPendingImport,
  clearPendingImport,
  deleteBrdFlow,
  ensureBrdFlow,
  getBrdFlow,
  markClarifyStarted,
  releaseGeneration,
  restorePendingImport,
  saveClarifyCheckpoint,
} from "./flow-state.js";
import { simpleDiff } from "./utils.js";
import { z } from "zod";
import {
  ClarificationOutputSchema,
  JudgeOutputSchema,
  extractBrdDocument,
  renderTemplateScaffold,
  templateExemplarBlock,
  templateInstructionBlock,
} from "@sa-ai-assistant/agent";
import { activeTemplateFor, agentFor, distillSessionContext } from "../chat/services.js";
import {
  FALLBACK_FOLLOW_UPS,
  FALLBACK_ROUND_1,
  canStageModification,
  canTransitionBrdStatus,
  followUpQuestions,
  missingRequiredSections,
  statusAfterModification,
  titleFromStory,
  weakRequiredSections,
  type BrdStatus,
} from "./flow-utils.js";

export type { BrdStatus } from "./flow-utils.js";
export type BrdCreatedBy = "AI_AGENT" | "USER_MANUAL";

export type BrdUpdateInput = BrdVersionCreateInput & {
  title?: string;
  status?: BrdStatus;
};

class VersionConflictError extends Error {
  constructor() {
    super("BRD version conflict");
    this.name = "VersionConflictError";
  }
}

const RETRYABLE_VERSION_CODES = new Set(["P2002", "P2034"]);

function isRetryableVersionError(error: unknown): boolean {
  if (error instanceof VersionConflictError) return true;
  const code = (error as { code?: string } | null)?.code;
  return Boolean(code && RETRYABLE_VERSION_CODES.has(code));
}

/**
 * Runs a version mutation under optimistic concurrency: the caller claims the
 * current version with a conditional update, and a conflict is retried.
 */
export async function withVersionRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableVersionError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
    }
  }
  throw lastError;
}

/** BRD aktif sebuah project (1:1); null bila project belum punya BRD. */
export async function findBrdByProject(userId: string, projectId: string) {
  return prisma.brdDocument.findFirst({ where: { userId, projectId } });
}

export async function createBrd(userId: string, input: BrdCreateInput) {
  const existing = await findBrdByProject(userId, input.projectId);
  if (existing) return existing;
  return prisma.brdDocument.create({
    data: {
      userId,
      projectId: input.projectId,
      sessionId: input.sessionId ?? null,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      versions: {
        create: {
          versionNumber: 1,
          contentMarkdown: input.contentMarkdown,
          changeSummary: input.changeSummary ?? "Initial draft",
        },
      },
    },
    include: { versions: true },
  });
}

export async function importBrdFromDocument(userId: string, input: BrdImportInput) {
  const document = await prisma.document.findFirst({
    where: {
      id: input.documentId,
      userId,
      projectId: input.projectId,
      status: { in: ["READY", "PENDING_CONFIRMATION"] },
    },
  });
  if (!document) return null;
  const pages = await prisma.documentPage.findMany({
    where: { documentId: document.id },
    orderBy: { pageNumber: "asc" },
  });
  const contentMarkdown = pages
    .map((page) => page.content.trim())
    .filter(Boolean)
    .join("\n\n");
  if (!contentMarkdown) return null;
  const fallbackTitle = document.title
    .replace(/\.[^.]+$/, "")
    .trim()
    .slice(0, 200);
  return createBrd(userId, {
    projectId: input.projectId,
    sessionId: input.sessionId,
    title: input.title ?? (fallbackTitle || "Imported BRD"),
    contentMarkdown,
    changeSummary: "Imported from existing BRD",
  });
}

export type PendingImportResult =
  | { ok: true; brd: BrdDocument }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_ready"; status: string }
  | { ok: false; reason: "in_progress" };

/**
 * Lanjutkan import yang tertunda (di-set saat upload lewat flag `brdImport`).
 * Klaim atomik memastikan dua tab tidak mengimpor dokumen yang sama dua kali.
 */
export async function importPendingBrd(
  userId: string,
  projectId: string,
  sessionId?: string,
): Promise<PendingImportResult> {
  const context = { userId, projectId, sessionId };
  const existing = await findBrdByProject(userId, projectId);
  const flow = await getBrdFlow(context);
  const documentId = flow?.pendingImportDocumentId ?? null;

  if (existing) {
    if (documentId) await clearPendingImport(context);
    return { ok: true, brd: existing };
  }
  if (!documentId) return { ok: false, reason: "not_found" };

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, projectId },
    select: { id: true, status: true },
  });
  if (!document) {
    await clearPendingImport(context);
    return { ok: false, reason: "not_found" };
  }
  if (document.status !== "READY" && document.status !== "PENDING_CONFIRMATION") {
    return { ok: false, reason: "not_ready", status: document.status };
  }
  if (!(await claimPendingImport(context, documentId))) {
    return { ok: false, reason: "in_progress" };
  }
  try {
    const brd = await importBrdFromDocument(userId, { projectId, sessionId, documentId });
    if (!brd) {
      await restorePendingImport(context, documentId);
      return { ok: false, reason: "not_ready", status: document.status };
    }
    return { ok: true, brd };
  } catch (error) {
    await restorePendingImport(context, documentId).catch(() => undefined);
    throw error;
  }
}

export async function listBrds(userId: string, projectId?: string) {
  return prisma.brdDocument.findMany({
    where: { userId, ...(projectId ? { projectId } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBrd(userId: string, id: string) {
  return prisma.brdDocument.findFirst({
    where: { id, userId },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });
}

export async function updateBrd(userId: string, id: string, input: BrdUpdateInput) {
  const nextContent = input.contentMarkdown;
  return withVersionRetry(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.brdDocument.findFirst({ where: { id, userId } });
      if (!current) return null;
      const contentChanged = nextContent !== current.contentMarkdown;
      const nextVersion = contentChanged ? current.currentVersion + 1 : current.currentVersion;
      if (contentChanged) {
        await tx.brdVersion.create({
          data: {
            brdDocumentId: current.id,
            versionNumber: nextVersion,
            contentMarkdown: nextContent,
            changeSummary: input.changeSummary ?? "Updated BRD",
            createdBy: input.createdBy,
          },
        });
      }
      const claimed = await tx.brdDocument.updateMany({
        where: { id: current.id, currentVersion: current.currentVersion },
        data: {
          ...(input.title ? { title: input.title } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(contentChanged ? { contentMarkdown: nextContent, currentVersion: nextVersion } : {}),
        },
      });
      if (claimed.count === 0) throw new VersionConflictError();
      return tx.brdDocument.findFirst({
        where: { id: current.id },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      });
    }),
  );
}

export async function deleteBrd(userId: string, id: string): Promise<boolean> {
  const deleted = await prisma.brdDocument.deleteMany({ where: { id, userId } });
  return deleted.count > 0;
}

export async function addBrdVersion(userId: string, id: string, input: BrdVersionCreateInput) {
  return withVersionRetry(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.brdDocument.findFirst({ where: { id, userId } });
      if (!current) return null;
      const number = current.currentVersion + 1;
      const created = await tx.brdVersion.create({
        data: {
          brdDocumentId: current.id,
          versionNumber: number,
          contentMarkdown: input.contentMarkdown,
          changeSummary: input.changeSummary ?? null,
          createdBy: input.createdBy,
        },
      });
      const claimed = await tx.brdDocument.updateMany({
        where: { id: current.id, currentVersion: current.currentVersion },
        data: { currentVersion: number, contentMarkdown: input.contentMarkdown },
      });
      if (claimed.count === 0) throw new VersionConflictError();
      return created;
    }),
  );
}

export async function diffBrdVersions(userId: string, id: string, from: number, to: number) {
  const versions = await prisma.brdVersion.findMany({
    where: {
      brdDocumentId: id,
      brdDocument: { userId },
      versionNumber: { in: [from, to] },
    },
  });
  const before = versions.find((item) => item.versionNumber === from);
  const after = versions.find((item) => item.versionNumber === to);
  if (!before || !after) return null;
  return { from, to, diff: simpleDiff(before.contentMarkdown, after.contentMarkdown) };
}

export async function restoreBrdVersion(userId: string, id: string, versionNumber: number) {
  return withVersionRetry(() =>
    prisma.$transaction(async (tx) => {
      const current = await tx.brdDocument.findFirst({
        where: { id, userId },
        include: { versions: true },
      });
      const version = current?.versions.find((item) => item.versionNumber === versionNumber);
      if (!current || !version) return null;
      const number = current.currentVersion + 1;
      await tx.brdVersion.create({
        data: {
          brdDocumentId: current.id,
          versionNumber: number,
          contentMarkdown: version.contentMarkdown,
          changeSummary: `Restored version ${versionNumber}`,
          createdBy: "USER_MANUAL",
        },
      });
      const claimed = await tx.brdDocument.updateMany({
        where: { id: current.id, currentVersion: current.currentVersion },
        data: { currentVersion: number, contentMarkdown: version.contentMarkdown },
      });
      if (claimed.count === 0) throw new VersionConflictError();
      return { currentVersion: number, contentMarkdown: version.contentMarkdown };
    }),
  );
}

export async function getBrdForExport(userId: string, id: string) {
  return prisma.brdDocument.findFirst({
    where: { id, userId },
    select: {
      title: true,
      contentMarkdown: true,
      currentVersion: true,
      status: true,
      updatedAt: true,
      approvedAt: true,
      approvedBy: true,
    },
  });
}

export type StageModificationResult =
  | { ok: true; status: "staged" }
  | {
      ok: false;
      reason: "pending_exists";
      pendingChangeSummary: string | null;
      pendingContentMarkdown: string;
    }
  | { ok: false; reason: "not_found" };

export async function stageBrdModification(
  userId: string,
  id: string,
  contentMarkdown: string,
  changeSummary: string,
): Promise<StageModificationResult> {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd) return { ok: false, reason: "not_found" };
  const decision = canStageModification(brd.pendingContentMarkdown, contentMarkdown);
  if (decision === "conflict") {
    return {
      ok: false,
      reason: "pending_exists",
      pendingChangeSummary: brd.pendingChangeSummary,
      pendingContentMarkdown: brd.pendingContentMarkdown ?? "",
    };
  }
  if (decision === "noop") return { ok: true, status: "staged" };
  // A staged change puts the document under review; reject restores the
  // status the user had before the preview appeared.
  await prisma.brdDocument.update({
    where: { id },
    data: {
      pendingContentMarkdown: contentMarkdown,
      pendingChangeSummary: changeSummary,
      statusBeforePending: brd.statusBeforePending ?? brd.status,
      status: "IN_REVIEW",
    },
  });
  return { ok: true, status: "staged" };
}

export async function approveBrdModification(userId: string, id: string) {
  return withVersionRetry(() =>
    prisma.$transaction(async (tx) => {
      const brd = await tx.brdDocument.findFirst({ where: { id, userId } });
      const pendingContent = brd?.pendingContentMarkdown;
      if (!brd || !pendingContent) return null;
      const nextVersion = brd.currentVersion + 1;
      const nextStatus = statusAfterModification();
      const claimed = await tx.brdDocument.updateMany({
        where: {
          id,
          userId,
          currentVersion: brd.currentVersion,
          pendingContentMarkdown: { not: null },
        },
        data: {
          contentMarkdown: pendingContent,
          currentVersion: nextVersion,
          pendingContentMarkdown: null,
          pendingChangeSummary: null,
          status: nextStatus,
          statusBeforePending: null,
          // The content changed, so any previous approval is invalidated.
          approvedAt: null,
          approvedBy: null,
        },
      });
      if (claimed.count === 0) throw new VersionConflictError();
      const version = await tx.brdVersion.create({
        data: {
          brdDocumentId: id,
          versionNumber: nextVersion,
          contentMarkdown: pendingContent,
          changeSummary: brd.pendingChangeSummary ?? "Approved BRD modification",
          createdBy: "AI_AGENT",
        },
      });
      const updated = await tx.brdDocument.findFirst({
        where: { id },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      });
      return { brd: updated, version };
    }),
  );
}

export async function rejectBrdModification(userId: string, id: string) {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd?.pendingContentMarkdown) return null;
  return prisma.brdDocument.update({
    where: { id },
    data: {
      pendingContentMarkdown: null,
      pendingChangeSummary: null,
      status: (brd.statusBeforePending ?? brd.status) as BrdStatus,
      statusBeforePending: null,
    },
  });
}

export type ChangeBrdStatusResult =
  | { ok: true; brd: NonNullable<Awaited<ReturnType<typeof getBrd>>> }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; current: BrdStatus };

export async function changeBrdStatus(
  userId: string,
  id: string,
  nextStatus: BrdStatus,
): Promise<ChangeBrdStatusResult> {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd) return { ok: false, reason: "not_found" };
  const current = brd.status as BrdStatus;
  if (!canTransitionBrdStatus(current, nextStatus)) {
    return { ok: false, reason: "invalid_transition", current };
  }
  const updated = await prisma.brdDocument.update({
    where: { id },
    data: {
      status: nextStatus,
      statusBeforePending: null,
      ...(nextStatus === "APPROVED"
        ? { approvedAt: new Date(), approvedBy: userId }
        : { approvedAt: null, approvedBy: null }),
    },
    include: { versions: { orderBy: { versionNumber: "asc" } } },
  });
  return { ok: true, brd: updated };
}

type FlowInput = {
  userStory: string;
  answers?: Record<string, string>;
  round?: number;
  skip?: boolean;
};
type FlowContext = { userId: string; projectId: string; sessionId?: string };

async function flowTemplateBlock(userId: string, projectId: string): Promise<string | null> {
  const active = await activeTemplateFor(userId, projectId);
  return active ? templateInstructionBlock(active.structure) : null;
}

/**
 * Jalankan agent sampai selesai, atau berhenti lebih awal begitu tool yang
 * diminta sudah menghasilkan output (mis. elicit_clarifications). Early exit
 * menghemat satu turn LLM yang hanya mengulang hasil tool.
 */
export async function collectAgent(
  agent: Awaited<ReturnType<typeof agentFor>>,
  prompt: string,
  context: FlowContext,
  options: { stopOnTool?: string } = {},
) {
  let text = "";
  const toolResults: Array<{ toolName?: string; output?: { type?: string; value?: unknown } }> = [];
  const run: {
    prompt: { role: "user"; content: string };
    session?: { sessionId: string; userId: string; metadata: { userId: string } };
  } = { prompt: { role: "user", content: prompt } };
  if (agent.memory !== undefined && context.sessionId) {
    run.session = {
      sessionId: context.sessionId,
      userId: context.userId,
      metadata: { userId: context.userId },
    };
  }
  for await (const event of agent.stream(run)) {
    if (event.type === "text_delta") text += event.delta ?? "";
    if (event.type === "tool_result") {
      toolResults.push(event);
      const output = (event as { output?: { value?: unknown } }).output;
      const hasOutput = output?.value != null;
      if (options.stopOnTool && event.toolName === options.stopOnTool && hasOutput) break;
    }
  }
  return { text, toolResults };
}

/** Parse agent JSON output leniently: tolerate markdown fences and surrounding prose. */
function parseLooseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function safeParse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Toleransi deviasi kecil pada output agent klarifikasi: id diacak ulang ke
 * q{round}_{n}, field dianggap opsional, dan daftar dibatasi maksimal 3.
 * Mengembalikan null ketika tidak ada pertanyaan yang bisa diselamatkan.
 */
function normalizeClarificationOutput(
  value: unknown,
  round: number,
): z.infer<typeof ClarificationOutputSchema> | null {
  const direct = safeParse(ClarificationOutputSchema, value);
  if (direct) return direct;
  const object = typeof value === "object" && value !== null ? value : {};
  const list = (object as { clarification_questions?: unknown }).clarification_questions;
  if (!Array.isArray(list)) return null;
  const questions = list
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) => item.question)
    .filter((question) => typeof question === "string" && question.trim().length > 0)
    .slice(0, 3)
    .map((question, index) => ({
      id: `q${round}_${index + 1}`,
      question: question as string,
      purpose:
        typeof (list[index] as { purpose?: unknown }).purpose === "string" &&
        (list[index] as { purpose?: string }).purpose!.trim()
          ? (list[index] as { purpose?: string }).purpose!
          : "Resolve an implementation-impacting ambiguity.",
      options: Array.isArray((list[index] as { options?: unknown }).options)
        ? (
            (list[index] as { options: unknown }).options as unknown[]
          )
            .filter(
              (option): option is string =>
                typeof option === "string" && option.trim().length > 0,
            )
            .slice(0, 5)
        : [],
      required: (list[index] as { required?: unknown }).required === true,
    }));
  if (!questions.length) return null;
  return { clarification_questions: questions, round, capped: round === 2 };
}

async function resolveClarificationOutput(
  agent: Awaited<ReturnType<typeof agentFor>>,
  prompt: string,
  context: FlowContext,
  round: number,
): Promise<z.infer<typeof ClarificationOutputSchema> | null> {
  const result = await collectAgent(agent, prompt, context, {
    stopOnTool: "elicit_clarifications",
  });
  const tool = result.toolResults.find((item) => item.toolName === "elicit_clarifications");
  let raw = tool?.output?.value ?? parseLooseJson(result.text) ?? {};
  if (typeof raw === "string") raw = parseLooseJson(raw) ?? {};
  return normalizeClarificationOutput(raw, round);
}

type BrdAudit = { missing: string[]; weak: string[] };

function headingCount(markdown: string): number {
  return (markdown.match(/^##\s+/gm) ?? []).length;
}

/** Kandidat dianggap BRD utuh bila punya heading `# BRD` atau minimal 3 section. */
function isBrdLike(markdown: string): boolean {
  return /(^|\n)#\s+BRD\b/i.test(markdown) || headingCount(markdown) >= 3;
}

export function hasMermaidFlowchart(markdown: string): boolean {
  return /```mermaid[\s\S]*?```/i.test(markdown);
}

/**
 * Peringkat kandidat BRD secara leksikografis: bentuk BRD utuh dulu, lalu
 * section wajib yang hilang/tipis paling sedikit, lalu kelengkapan flowchart.
 */
function rankCandidate(markdown: string, issues: BrdAudit): [number, number, number] {
  return [
    isBrdLike(markdown) ? 0 : 1,
    issues.missing.length + issues.weak.length,
    hasMermaidFlowchart(markdown) ? 0 : 1,
  ];
}

function isBetterRank(a: readonly number[], b: readonly number[]): boolean {
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index];
  }
  return false;
}

/**
 * Pilih markdown terbaik dari beberapa kandidat (teks jawaban vs argumen tool):
 * pakai peringkat lalu fallback ke dokumen terpanjang.
 */
export function pickBestMarkdown(
  candidates: string[],
  audit: (markdown: string) => BrdAudit,
): { markdown: string; issues: BrdAudit } | null {
  const unique = [...new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean))];
  if (!unique.length) return null;
  const scored = unique.map((markdown) => ({ markdown, issues: audit(markdown) }));
  scored.sort((a, b) => {
    const rankA = rankCandidate(a.markdown, a.issues);
    const rankB = rankCandidate(b.markdown, b.issues);
    if (isBetterRank(rankA, rankB)) return -1;
    if (isBetterRank(rankB, rankA)) return 1;
    return b.markdown.length - a.markdown.length;
  });
  return scored[0];
}

export async function clarifyFlow(context: FlowContext, input: FlowInput) {
  const round = Math.min(Math.max(input.round ?? 1, 1), 2);
  // Persist dulu supaya reload di tengah request tidak jatuh ke sesi kosong.
  await markClarifyStarted(context, {
    userStory: input.userStory,
    round,
    answers: input.answers ?? {},
  });
  const templateBlock = await flowTemplateBlock(context.userId, context.projectId);
  const agent = await agentFor(context, "CLARIFY");
  const prompt = [
    `Round: ${round}`,
    `User story (data):\n${input.userStory}`,
    `Prior answers (data):\n${JSON.stringify(input.answers ?? {})}`,
    templateBlock
      ? `TEMPLATE AKTIF (gunakan untuk memilih pertanyaan yang mengisi section wajib):\n${templateBlock}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  let parsed = await resolveClarificationOutput(agent, prompt, context, round);
  if (!parsed) {
    // Panggilan tool sempat gagal (mis. id pertanyaan tidak sesuai pola):
    // beri agent satu kesempatan ulang sebelum degradasi ke pertanyaan fallback.
    parsed = await resolveClarificationOutput(
      agent,
      `${prompt}\n\nIngat: output wajib dikembalikan lewat tool elicit_clarifications dalam satu panggilan. Jangan menulis pertanyaan sebagai teks biasa.`,
      context,
      round,
    );
  }
  if (!parsed) {
    parsed = {
      clarification_questions:
        round === 2 ? FALLBACK_FOLLOW_UPS : FALLBACK_ROUND_1,
      round,
      capped: round === 2,
    };
  }
  await saveClarifyCheckpoint(context, {
    userStory: input.userStory,
    round: parsed.round,
    questions: parsed.clarification_questions,
    answers: input.answers ?? {},
  });
  return {
    type: "clarification" as const,
    round: parsed.round,
    clarification_questions: parsed.clarification_questions,
    capped: parsed.capped,
  };
}

export async function submitClarificationFlow(context: FlowContext, input: FlowInput) {
  const round = Math.min(Math.max(input.round ?? 1, 1), 2);
  const answers = input.answers ?? {};

  // Idempotent: a BRD produced earlier (even if the response was lost) always wins.
  const existing = await findBrdByProject(context.userId, context.projectId);
  if (existing) {
    await deleteBrdFlow(context);
    return {
      type: "brd" as const,
      round,
      brd: existing,
      markdown: existing.contentMarkdown,
      assumptions: [],
      context: "",
    };
  }

  const contextText = await distillSessionContext(context.userId, context.projectId);
  const activeTemplate = await activeTemplateFor(context.userId, context.projectId);
  const templateBlock = activeTemplate ? templateInstructionBlock(activeTemplate.structure) : null;
  let sufficient = Boolean(input.skip) || round === 2;
  if (!sufficient) {
    const judge = await agentFor(context, "JUDGE");
    const judged = await collectAgent(
      judge,
      `Return JSON only with sufficient, missing, and clarification_questions. You are judging round ${round}; do not generate a BRD. If round 1 has any material gap in actors, scope, workflow, validation, permissions, failure handling, integrations, or acceptance criteria, set sufficient=false and return follow-up questions in Indonesian. User story (data): ${input.userStory}\nAnswers (data): ${JSON.stringify(answers)}\nContext (data): ${contextText}${templateBlock ? `\n\nTEMPLATE AKTIF (nilai kecukupan terhadap section wajib template):\n${templateBlock}` : ""}`,
      context,
    );
    const judgedOutput = safeParse(JudgeOutputSchema, parseLooseJson(judged.text) ?? {});
    sufficient = judgedOutput?.sufficient ?? false;
    if (!sufficient && round < 2) {
      const followUps = judgedOutput
        ? followUpQuestions(judgedOutput.clarification_questions, answers)
        : FALLBACK_FOLLOW_UPS;
      await saveClarifyCheckpoint(context, {
        userStory: input.userStory,
        round: 2,
        questions: followUps,
        answers,
      });
      return {
        type: "clarification" as const,
        round: 2,
        clarification_questions: followUps,
        capped: true,
      };
    }
  }

  await ensureBrdFlow(context, { userStory: input.userStory, round, answers });
  if (!(await claimGeneration(context))) {
    // Another tab/request is still writing this BRD; the client polls the flow.
    return { type: "generating" as const };
  }

  try {
    const agent = await agentFor(context, "GENERATE");
    const structure = activeTemplate?.structure ?? null;
    const exemplarBlock = activeTemplate ? templateExemplarBlock(activeTemplate.structure) : "";
    const answerLines = Object.keys(answers).length
      ? Object.entries(answers)
          .map(([id, answer]) => `- ${id}: ${answer}`)
          .join("\n")
      : "- Tidak ada jawaban klarifikasi.";
    // Kerangka dari template aktif supaya struktur final tidak bergeser ke
    // skeleton bawaan agen; JSON-nya dipakai agen untuk argumen draft_brd.
    const scaffoldBlock = activeTemplate
      ? renderTemplateScaffold(activeTemplate.structure, {
          userStory: input.userStory,
          clarificationText: `\n${input.userStory}\n\n${answerLines}`,
          assumptionsText: "- (tulis asumsi eksplisit bila ada)",
          referenceText: contextText || "- Tidak ada konteks referensi.",
          flowchart: "- (ganti dengan blok ```mermaid``` flowchart alur utama)",
        })
      : "";
    const structureJsonBlock = activeTemplate
      ? `STRUKTUR_TEMPLATE_JSON (data; salin objek ini apa adanya ke argumen templateStructure saat memanggil draft_brd):\n\`\`\`json\n${JSON.stringify(activeTemplate.structure)}\n\`\`\``
      : "";
    const generatePrompt = [
      `User story (data): ${input.userStory}`,
      `Answers (data): ${JSON.stringify(answers)}`,
      `Reference context (data): ${contextText}`,
      templateBlock
        ? `TEMPLATE AKTIF (WAJIB DIIKUTI - BRD final harus memuat semua section ini dengan urutan dan judul yang sama, isi setiap section secara lengkap):\n${templateBlock}`
        : "",
      scaffoldBlock
        ? `KERANGKA SECTION WAJIB (pertahankan heading, urutan, dan penomoran persis seperti ini; ganti placeholder "- (see ...)" dengan konten lengkap):\n${scaffoldBlock}`
        : "",
      structureJsonBlock,
      exemplarBlock,
      `Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid; gunakan draft_brd sebagai basis validasi, lalu tulis BRD final sebagai jawaban. force: ${input.skip || round === 2}`,
      `Tulis BRD final LANGSUNG sebagai jawaban akhir: mulai dengan heading "# BRD — <judul>" lalu salin seluruh isi markdown BRD (semua section berurutan). Jangan menulis kalimat pembuka, penjelasan proses, atau ringkasan di luar markdown BRD.`,
      `WAJIB: sertakan minimal satu blok berpagar \`\`\`mermaid berisi flowchart alur utama end-to-end di dalam BRD final.`,
    ]
      .filter(Boolean)
      .join("\n\n");
    const generated = await collectAgent(agent, generatePrompt, context);
    const tool = generated.toolResults.find((item) => item.toolName === "draft_brd");
    const value = tool?.output?.value as { markdown?: string; assumptions?: string[] } | undefined;

    const audit = (text: string) => ({
      missing: missingRequiredSections(text, structure),
      weak: weakRequiredSections(text, structure),
    });
    // Jawaban akhir kadang hanya berupa narasi pembuka sementara BRD lengkap
    // ada di argumen tool draft_brd. Pilih kandidat paling layak, bukan asal
    // memprioritaskan teks jawaban.
    const picked = pickBestMarkdown(
      [generated.text, value?.markdown ?? ""].map((raw) =>
        raw.trim() ? extractBrdDocument(raw) : "",
      ),
      audit,
    );
    if (!picked) throw new Error("BRD generator returned no markdown");
    let markdown = picked.markdown;
    let issues = picked.issues;
    const flowchartProblem = hasMermaidFlowchart(markdown)
      ? ""
      : "belum memuat blok ```mermaid flowchart alur utama";
    if (issues.missing.length || issues.weak.length || flowchartProblem) {
      const problems = [
        issues.missing.length
          ? `belum memuat section wajib: ${issues.missing.join(", ")}`
          : "",
        issues.weak.length
          ? `section berikut isinya terlalu tipis dan harus diperdalam: ${issues.weak.join(", ")}`
          : "",
        flowchartProblem,
      ]
        .filter(Boolean)
        .join("; ");
      const retry = await collectAgent(
        agent,
        `${generatePrompt}\n\nKOREKSI: BRD yang baru saja ditulis ${problems}. Tulis ulang seluruh BRD sekali lagi: lengkapi section yang hilang dan perdalam section yang tipis (jangan satu baris; sertakan detail perilaku, validasi, dan tabel/daftar yang relevan).`,
        context,
      );
      const retryTool = retry.toolResults.find((item) => item.toolName === "draft_brd");
      const retryValue = retryTool?.output?.value as { markdown?: string } | undefined;
      const retryPicked = pickBestMarkdown(
        [retry.text, retryValue?.markdown ?? ""].map((raw) =>
          raw.trim() ? extractBrdDocument(raw) : "",
        ),
        audit,
      );
      if (retryPicked) {
        const currentRank = rankCandidate(markdown, issues);
        const retryRank = rankCandidate(retryPicked.markdown, retryPicked.issues);
        if (isBetterRank(retryRank, currentRank)) {
          markdown = retryPicked.markdown;
          issues = retryPicked.issues;
        }
      }
      const stillMissing = issues.missing.length || issues.weak.length;
      if (stillMissing || !hasMermaidFlowchart(markdown))
        console.warn(
          `BRD still incomplete after retry: missing=[${issues.missing.join(", ")}] weak=[${issues.weak.join(", ")}] mermaid=${hasMermaidFlowchart(markdown)}`,
        );
    }

    const brd = await createBrd(context.userId, {
      projectId: context.projectId,
      sessionId: context.sessionId,
      title: titleFromStory(input.userStory),
      contentMarkdown: markdown,
      changeSummary: "Draf awal",
    });
    await deleteBrdFlow(context);
    return {
      type: "brd" as const,
      round,
      brd,
      markdown,
      assumptions: value?.assumptions ?? [],
      context: contextText,
    };
  } catch (error) {
    // Keep phase GENERATING so the UI offers "lanjutkan", but free the lock.
    await releaseGeneration(context).catch(() => undefined);
    throw error;
  }
}
