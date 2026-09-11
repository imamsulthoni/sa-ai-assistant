import { prisma } from "../../lib/prisma.js";
import type { BrdCreateInput, BrdVersionCreateInput } from "../../lib/api-contract.js";
import { simpleDiff } from "./utils.js";

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
  return prisma.brdDocument.findFirst({
    where: { id, userId },
    select: { title: true, contentMarkdown: true },
  });
}
