import { prisma } from "../../lib/prisma.js";
import type {
  BrdCreateInput,
  BrdImportInput,
  BrdVersionCreateInput,
} from "../../lib/api-contract.js";
import { simpleDiff } from "./utils.js";
import { z } from "zod";
import {
  ClarificationOutputSchema,
  JudgeOutputSchema,
  extractBrdDocument,
  templateInstructionBlock,
} from "@sa-ai-assistant/agent";
import { activeTemplateFor, agentFor, distillSessionContext } from "../chat/services.js";
import {
  FALLBACK_FOLLOW_UPS,
  canStageModification,
  canTransitionBrdStatus,
  followUpQuestions,
  missingRequiredSections,
  statusAfterModification,
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

export async function createBrd(userId: string, input: BrdCreateInput) {
  return prisma.brdDocument.create({
    data: {
      userId,
      sessionId: input.sessionId,
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
      sessionId: input.sessionId,
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
    sessionId: input.sessionId,
    title: input.title ?? (fallbackTitle || "Imported BRD"),
    contentMarkdown,
    changeSummary: "Imported from existing BRD",
  });
}

export async function listBrds(userId: string, sessionId?: string) {
  return prisma.brdDocument.findMany({
    where: { userId, ...(sessionId ? { sessionId } : {}) },
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
  await prisma.brdDocument.update({
    where: { id },
    data: { pendingContentMarkdown: contentMarkdown, pendingChangeSummary: changeSummary },
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
      const currentStatus = brd.status as BrdStatus;
      const nextStatus = statusAfterModification(currentStatus);
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
          ...(currentStatus === "APPROVED" ? { approvedAt: null, approvedBy: null } : {}),
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
    data: { pendingContentMarkdown: null, pendingChangeSummary: null },
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
type FlowContext = { userId: string; sessionId: string };

async function flowTemplateBlock(userId: string): Promise<string | null> {
  const active = await activeTemplateFor(userId);
  return active ? templateInstructionBlock(active.structure) : null;
}

async function collectAgent(
  agent: Awaited<ReturnType<typeof agentFor>>,
  prompt: string,
  context: FlowContext,
) {
  let text = "";
  const toolResults: Array<{ toolName?: string; output?: { type?: string; value?: unknown } }> = [];
  const run: {
    prompt: { role: "user"; content: string };
    session?: { sessionId: string; userId: string; metadata: { userId: string } };
  } = { prompt: { role: "user", content: prompt } };
  if (agent.memory !== undefined) {
    run.session = {
      sessionId: context.sessionId,
      userId: context.userId,
      metadata: { userId: context.userId },
    };
  }
  for await (const event of agent.stream(run)) {
    if (event.type === "text_delta") text += event.delta ?? "";
    if (event.type === "tool_result") toolResults.push(event);
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

export async function clarifyFlow(context: FlowContext, input: FlowInput) {
  const round = Math.min(Math.max(input.round ?? 1, 1), 2);
  const templateBlock = await flowTemplateBlock(context.userId);
  const agent = await agentFor(context.userId, context.sessionId, "CLARIFY");
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
  const result = await collectAgent(agent, prompt, context);
  const tool = result.toolResults.find((item) => item.toolName === "elicit_clarifications");
  const parsed = safeParse(
    ClarificationOutputSchema,
    tool?.output?.value ?? parseLooseJson(result.text) ?? {},
  );
  if (!parsed) throw new Error("Clarification agent returned invalid output");
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
  const contextText = await distillSessionContext(context.userId, context.sessionId);
  const activeTemplate = await activeTemplateFor(context.userId);
  const templateBlock = activeTemplate ? templateInstructionBlock(activeTemplate.structure) : null;
  let sufficient = Boolean(input.skip) || round === 2;
  if (!sufficient) {
    const judge = await agentFor(context.userId, context.sessionId, "JUDGE");
    const judged = await collectAgent(
      judge,
      `Return JSON only with sufficient, missing, and clarification_questions. You are judging round ${round}; do not generate a BRD. If round 1 has any material gap in actors, scope, workflow, validation, permissions, failure handling, integrations, or acceptance criteria, set sufficient=false and return follow-up questions in Indonesian. User story (data): ${input.userStory}\nAnswers (data): ${JSON.stringify(answers)}\nContext (data): ${contextText}${templateBlock ? `\n\nTEMPLATE AKTIF (nilai kecukupan terhadap section wajib template):\n${templateBlock}` : ""}`,
      context,
    );
    const judgedOutput = safeParse(JudgeOutputSchema, parseLooseJson(judged.text) ?? {});
    sufficient = judgedOutput?.sufficient ?? false;
    if (!sufficient && round < 2)
      return {
        type: "clarification" as const,
        round: 2,
        clarification_questions: judgedOutput
          ? followUpQuestions(judgedOutput.clarification_questions, answers)
          : FALLBACK_FOLLOW_UPS,
        capped: true,
      };
  }
  const agent = await agentFor(context.userId, context.sessionId, "GENERATE");
  const generatePrompt = [
    `User story (data): ${input.userStory}`,
    `Answers (data): ${JSON.stringify(answers)}`,
    `Reference context (data): ${contextText}`,
    templateBlock
      ? `TEMPLATE AKTIF (WAJIB DIIKUTI - BRD final harus memuat semua section ini dengan urutan dan judul yang sama, isi setiap section secara lengkap):\n${templateBlock}`
      : "",
    `Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid; gunakan draft_brd sebagai basis validasi, lalu tulis BRD final sebagai jawaban. force: ${input.skip || round === 2}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const generated = await collectAgent(agent, generatePrompt, context);
  const tool = generated.toolResults.find((item) => item.toolName === "draft_brd");
  const value = tool?.output?.value as { markdown?: string; assumptions?: string[] } | undefined;
  let markdown = extractBrdDocument(generated.text.trim() || value?.markdown || "");
  if (!markdown) throw new Error("BRD generator returned no markdown");
  const missing = missingRequiredSections(markdown, activeTemplate?.structure ?? null);
  if (missing.length) {
    const retry = await collectAgent(
      agent,
      `${generatePrompt}\n\nKOREKSI: BRD yang baru saja ditulis belum memuat section wajib template berikut: ${missing.join(", ")}. Tulis ulang seluruh BRD sekali lagi, lengkap dengan semua section tersebut.`,
      context,
    );
    const retryText = extractBrdDocument(retry.text);
    const retryMissing = retryText
      ? missingRequiredSections(retryText, activeTemplate?.structure ?? null)
      : missing;
    if (retryMissing.length < missing.length && retryText) markdown = retryText;
    if (retryMissing.length)
      console.warn(`BRD missing template sections after retry: ${retryMissing.join(", ")}`);
  }
  return {
    type: "brd" as const,
    round,
    markdown,
    assumptions: value?.assumptions ?? [],
    context: contextText,
  };
}
