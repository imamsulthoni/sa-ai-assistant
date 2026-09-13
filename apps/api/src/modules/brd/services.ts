import { prisma } from "../../lib/prisma.js";
import type { BrdCreateInput, BrdVersionCreateInput } from "../../lib/api-contract.js";
import { simpleDiff } from "./utils.js";
import { z } from "zod";
import { ClarificationOutputSchema, JudgeOutputSchema, templateInstructionBlock, type BrdTemplateStructure, type JudgeOutput } from "@sa-ai-assistant/agent";
import { activeTemplateFor, agentFor, distillSessionContext } from "../chat/services.js";

export type BrdStatus = "DRAFT" | "IN_REVIEW" | "APPROVED";
export type BrdCreatedBy = "AI_AGENT" | "USER_MANUAL";

export type BrdUpdateInput = BrdVersionCreateInput & {
  title?: string;
  status?: BrdStatus;
};

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
  const current = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!current) return null;
  const nextContent = input.contentMarkdown;
  const updated = await prisma.$transaction(async (tx) => {
    let currentVersion = current.currentVersion;
    if (nextContent !== current.contentMarkdown) {
      currentVersion += 1;
      await tx.brdVersion.create({
        data: {
          brdDocumentId: current.id,
          versionNumber: currentVersion,
          contentMarkdown: nextContent,
          changeSummary: input.changeSummary ?? "Updated BRD",
          createdBy: input.createdBy,
        },
      });
    }
    return tx.brdDocument.update({
      where: { id: current.id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(nextContent !== current.contentMarkdown
          ? { contentMarkdown: nextContent, currentVersion }
          : {}),
      },
      include: { versions: { orderBy: { versionNumber: "asc" } } },
    });
  });
  return updated;
}

export async function deleteBrd(userId: string, id: string): Promise<boolean> {
  const deleted = await prisma.brdDocument.deleteMany({ where: { id, userId } });
  return deleted.count > 0;
}

export async function addBrdVersion(userId: string, id: string, input: BrdVersionCreateInput) {
  const current = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!current) return null;
  return prisma.$transaction(async (tx) => {
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
    await tx.brdDocument.update({
      where: { id: current.id },
      data: { currentVersion: number, contentMarkdown: input.contentMarkdown },
    });
    return created;
  });
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
  const current = await prisma.brdDocument.findFirst({
    where: { id, userId },
    include: { versions: true },
  });
  const version = current?.versions.find((item) => item.versionNumber === versionNumber);
  if (!current || !version) return null;
  const number = current.currentVersion + 1;
  await prisma.$transaction([
    prisma.brdVersion.create({
      data: {
        brdDocumentId: current.id,
        versionNumber: number,
        contentMarkdown: version.contentMarkdown,
        changeSummary: `Restored version ${versionNumber}`,
        createdBy: "USER_MANUAL",
      },
    }),
    prisma.brdDocument.update({
      where: { id: current.id },
      data: { currentVersion: number, contentMarkdown: version.contentMarkdown },
    }),
  ]);
  return { currentVersion: number, contentMarkdown: version.contentMarkdown };
}

export async function getBrdForExport(userId: string, id: string) {
  return prisma.brdDocument.findFirst({ where: { id, userId }, select: { title: true, contentMarkdown: true } });
}

export async function stageBrdModification(userId: string, id: string, contentMarkdown: string, changeSummary: string) {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd) return null;
  return prisma.brdDocument.update({ where: { id }, data: { pendingContentMarkdown: contentMarkdown, pendingChangeSummary: changeSummary } });
}

export async function approveBrdModification(userId: string, id: string) {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  const pendingContent = brd?.pendingContentMarkdown;
  if (!brd || !pendingContent) return null;
  const nextVersion = brd.currentVersion + 1;
  return prisma.$transaction(async (tx) => {
    const version = await tx.brdVersion.create({ data: { brdDocumentId: id, versionNumber: nextVersion, contentMarkdown: pendingContent, changeSummary: brd.pendingChangeSummary ?? "Approved BRD modification", createdBy: "AI_AGENT" } });
    const updated = await tx.brdDocument.update({ where: { id }, data: { contentMarkdown: pendingContent, currentVersion: nextVersion, pendingContentMarkdown: null, pendingChangeSummary: null }, include: { versions: { orderBy: { versionNumber: "asc" } } } });
    return { brd: updated, version };
  });
}

export async function rejectBrdModification(userId: string, id: string) {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd?.pendingContentMarkdown) return null;
  return prisma.brdDocument.update({ where: { id }, data: { pendingContentMarkdown: null, pendingChangeSummary: null } });
}


type FlowInput = { userStory: string; answers?: Record<string, string>; round?: number; skip?: boolean };
type FlowContext = { userId: string; sessionId: string };

const FALLBACK_FOLLOW_UPS: JudgeOutput["clarification_questions"] = [
  { id: "q2_1", question: "Apa alur utama yang harus dilakukan pengguna dari pengajuan sampai selesai?", purpose: "Melengkapi alur pengguna dan perubahan status.", options: [], required: true },
  { id: "q2_2", question: "Apa validasi dan kondisi gagal yang harus ditangani sistem?", purpose: "Melengkapi validasi dan exception flow.", options: [], required: true },
  { id: "q2_3", question: "Apa kriteria yang menentukan bahwa proses berhasil?", purpose: "Melengkapi acceptance criteria yang dapat diuji.", options: [], required: true },
];

/** Ensure round-2 questions are fresh: drop answered ids, renumber to q2_{n}, cap at 3. */
function followUpQuestions(questions: JudgeOutput["clarification_questions"], answers: Record<string, string>) {
  const answered = new Set(Object.keys(answers));
  const fresh = questions
    .filter((question) => !answered.has(question.id))
    .map((question, index) => ({ ...question, id: `q2_${index + 1}` }))
    .slice(0, 3);
  return fresh.length ? fresh : FALLBACK_FOLLOW_UPS;
}

async function flowTemplateBlock(userId: string): Promise<string | null> {
  const active = await activeTemplateFor(userId);
  return active ? templateInstructionBlock(active.structure) : null;
}

function missingRequiredSections(markdown: string, structure: BrdTemplateStructure | null): string[] {
  if (!structure) return [];
  const haystack = markdown.toLowerCase();
  return structure.sections
    .filter((section) => section.required)
    .filter((section) => {
      const title = section.title.toLowerCase();
      const id = section.id.toLowerCase();
      return !haystack.includes(title) && !haystack.includes(id);
    })
    .map((section) => section.title);
}

async function collectAgent(agent: Awaited<ReturnType<typeof agentFor>>, prompt: string, context: FlowContext) {
  let text = "";
  const toolResults: Array<{ toolName?: string; output?: { type?: string; value?: unknown } }> = [];
  const run: { prompt: { role: "user"; content: string }; session?: { sessionId: string; userId: string; metadata: { userId: string } } } = { prompt: { role: "user", content: prompt } };
  if (agent.memory !== undefined) {
    run.session = { sessionId: context.sessionId, userId: context.userId, metadata: { userId: context.userId } };
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
    templateBlock ? `TEMPLATE AKTIF (gunakan untuk memilih pertanyaan yang mengisi section wajib):\n${templateBlock}` : "",
  ].filter(Boolean).join("\n\n");
  const result = await collectAgent(agent, prompt, context);
  const tool = result.toolResults.find((item) => item.toolName === "elicit_clarifications");
  const parsed = safeParse(
    ClarificationOutputSchema,
    tool?.output?.value ?? parseLooseJson(result.text) ?? {},
  );
  if (!parsed) throw new Error("Clarification agent returned invalid output");
  return { type: "clarification" as const, round: parsed.round, clarification_questions: parsed.clarification_questions, capped: parsed.capped };
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
    const judged = await collectAgent(judge, `Return JSON only with sufficient, missing, and clarification_questions. You are judging round ${round}; do not generate a BRD. If round 1 has any material gap in actors, scope, workflow, validation, permissions, failure handling, integrations, or acceptance criteria, set sufficient=false and return follow-up questions in Indonesian. User story (data): ${input.userStory}\nAnswers (data): ${JSON.stringify(answers)}\nContext (data): ${contextText}${templateBlock ? `\n\nTEMPLATE AKTIF (nilai kecukupan terhadap section wajib template):\n${templateBlock}` : ""}`, context);
    const judgedOutput = safeParse(JudgeOutputSchema, parseLooseJson(judged.text) ?? {});
    sufficient = judgedOutput?.sufficient ?? false;
    if (!sufficient && round < 2) return {
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
    templateBlock ? `TEMPLATE AKTIF (WAJIB DIIKUTI - BRD final harus memuat semua section ini dengan urutan dan judul yang sama, isi setiap section secara lengkap):\n${templateBlock}` : "",
    `Generate BRD lengkap berbahasa Indonesia dengan flowchart mermaid; gunakan draft_brd sebagai basis validasi, lalu tulis BRD final sebagai jawaban. force: ${input.skip || round === 2}`,
  ].filter(Boolean).join("\n\n");
  const generated = await collectAgent(agent, generatePrompt, context);
  const tool = generated.toolResults.find((item) => item.toolName === "draft_brd");
  const value = tool?.output?.value as { markdown?: string; assumptions?: string[] } | undefined;
  let markdown = generated.text.trim() || value?.markdown || "";
  if (!markdown) throw new Error("BRD generator returned no markdown");
  const missing = missingRequiredSections(markdown, activeTemplate?.structure ?? null);
  if (missing.length) {
    const retry = await collectAgent(agent, `${generatePrompt}\n\nKOREKSI: BRD yang baru saja ditulis belum memuat section wajib template berikut: ${missing.join(", ")}. Tulis ulang seluruh BRD sekali lagi, lengkap dengan semua section tersebut.`, context);
    const retryText = retry.text.trim();
    const retryMissing = retryText ? missingRequiredSections(retryText, activeTemplate?.structure ?? null) : missing;
    if (retryMissing.length < missing.length && retryText) markdown = retryText;
    if (retryMissing.length) console.warn(`BRD missing template sections after retry: ${retryMissing.join(", ")}`);
  }
  return { type: "brd" as const, round, markdown, assumptions: value?.assumptions ?? [], context: contextText };
}
