import { prisma } from "../../lib/prisma.js";
import type { BrdCreateInput, BrdVersionCreateInput } from "../../lib/api-contract.js";
import { simpleDiff } from "./utils.js";
import { ClarificationOutputSchema } from "@sa-ai-assistant/agent";
import { JudgeOutputSchema } from "@sa-ai-assistant/agent";
import { agentFor, distillSessionContext } from "../chat/services.js";
import { clarificationGateHeuristically } from "../chat/utils.js";

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

async function collectAgent(agent: Awaited<ReturnType<typeof agentFor>>, prompt: string, context: FlowContext) {
  let text = "";
  const toolResults: Array<{ toolName?: string; output?: { type?: string; value?: unknown } }> = [];
  for await (const event of agent.stream({ prompt: { role: "user", content: prompt }, session: { sessionId: context.sessionId, userId: context.userId, metadata: { userId: context.userId } } })) {
    if (event.type === "text_delta") text += event.delta ?? "";
    if (event.type === "tool_result") toolResults.push(event);
  }
  return { text, toolResults };
}

export async function clarifyFlow(context: FlowContext, input: FlowInput) {
  const round = Math.min(Math.max(input.round ?? 1, 1), 2);
  const agent = await agentFor(context.userId, context.sessionId, "CLARIFY");
  const result = await collectAgent(agent, `Round: ${round}\nUser story (data):\n${input.userStory}\nPrior answers (data):\n${JSON.stringify(input.answers ?? {})}`, context);
  const tool = result.toolResults.find((item) => item.toolName === "elicit_clarifications");
  const parsed = ClarificationOutputSchema.safeParse(tool?.output?.value ?? JSON.parse(result.text || "{}"));
  if (!parsed.success) throw new Error("Clarification agent returned invalid output");
  return { type: "clarification" as const, round: parsed.data.round, clarification_questions: parsed.data.clarification_questions, capped: parsed.data.capped };
}

export async function submitClarificationFlow(context: FlowContext, input: FlowInput) {
  const round = Math.min(Math.max(input.round ?? 1, 1), 2);
  const answers = input.answers ?? {};
  const contextText = await distillSessionContext(context.userId, context.sessionId);
  let sufficient = Boolean(input.skip) || round === 2 || clarificationGateHeuristically(input.userStory, answers);
  if (!sufficient) {
    const judge = await agentFor(context.userId, context.sessionId, "JUDGE");
    const judged = await collectAgent(judge, `Return JSON only matching {sufficient:boolean,missing:string[],clarification_questions:array}. Round: ${round}. User story (data): ${input.userStory}\nAnswers (data): ${JSON.stringify(answers)}\nContext (data): ${contextText}`, context);
    const parsed = JudgeOutputSchema.safeParse(JSON.parse(judged.text || "{}"));
    sufficient = parsed.success ? parsed.data.sufficient : false;
    if (!sufficient && round < 2 && parsed.success) return { type: "clarification" as const, round: 2, clarification_questions: parsed.data.clarification_questions, capped: true };
  }
  const agent = await agentFor(context.userId, context.sessionId, "GENERATE");
  const generated = await collectAgent(agent, `User story (data): ${input.userStory}\nAnswers (data): ${JSON.stringify(answers)}\nReference context (data): ${contextText}\nGenerate using draft_brd; force: ${input.skip || round === 2}`, context);
  const tool = generated.toolResults.find((item) => item.toolName === "draft_brd");
  const value = tool?.output?.value as { markdown?: string; assumptions?: string[] } | undefined;
  if (!value?.markdown) throw new Error("BRD generator returned no markdown");
  return { type: "brd" as const, round, markdown: value.markdown, assumptions: value.assumptions ?? [], context: contextText };
}
