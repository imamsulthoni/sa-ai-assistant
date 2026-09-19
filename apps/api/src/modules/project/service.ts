import { prisma } from "../../lib/prisma.js";
import { deleteDocument, deleteDocumentVectors } from "../document/services.js";
import type { ProjectCreateInput, ProjectUpdateInput } from "./schema.js";

export const DEFAULT_PROJECT_NAME = "Inbox";

export type ProjectBrdSummary = {
  id: string;
  title: string;
  currentVersion: number;
  status: "DRAFT" | "IN_REVIEW" | "APPROVED";
  hasPendingModification: boolean;
};

export type ProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  isDefault: boolean;
  sessionCount: number;
  documentCount: number;
  brd: ProjectBrdSummary | null;
  createdAt: string;
  updatedAt: string;
};

const projectInclude = {
  _count: { select: { sessions: true, documents: true } },
  brds: {
    take: 1,
    select: {
      id: true,
      title: true,
      currentVersion: true,
      status: true,
      pendingContentMarkdown: true,
    },
  },
} as const;

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  templateId: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { sessions: number; documents: number };
  brds: Array<{
    id: string;
    title: string;
    currentVersion: number;
    status: string;
    pendingContentMarkdown: string | null;
  }>;
};

function toSummary(row: ProjectRow): ProjectSummary {
  const brd = row.brds[0];
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    templateId: row.templateId,
    isDefault: row.isDefault,
    sessionCount: row._count.sessions,
    documentCount: row._count.documents,
    brd: brd
      ? {
          id: brd.id,
          title: brd.title,
          currentVersion: brd.currentVersion,
          status: brd.status as ProjectBrdSummary["status"],
          hasPendingModification: Boolean(brd.pendingContentMarkdown),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  const rows = await prisma.project.findMany({
    where: { userId },
    orderBy: [{ isDefault: "asc" }, { updatedAt: "desc" }],
    include: projectInclude,
  });
  return rows.map(toSummary);
}

export async function getProject(
  userId: string,
  projectId: string,
): Promise<ProjectSummary | null> {
  const row = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: projectInclude,
  });
  return row ? toSummary(row) : null;
}

/** Template project hanya boleh menunjuk dokumen template milik user yang sama. */
async function validTemplateId(userId: string, templateId: string | null): Promise<boolean> {
  if (!templateId) return true;
  const template = await prisma.document.findFirst({
    where: { id: templateId, userId, isTemplate: true },
    select: { id: true },
  });
  return Boolean(template);
}

export async function createProject(
  userId: string,
  input: ProjectCreateInput,
): Promise<ProjectSummary> {
  const templateId = input.templateId ?? null;
  if (!(await validTemplateId(userId, templateId))) {
    throw new Error("Template not found");
  }
  const row = await prisma.project.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      templateId,
    },
    include: projectInclude,
  });
  return toSummary(row);
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: ProjectUpdateInput,
): Promise<ProjectSummary | null> {
  if (input.templateId !== undefined && !(await validTemplateId(userId, input.templateId))) {
    throw new Error("Template not found");
  }
  const existing = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  const row = await prisma.project.update({
    where: { id: existing.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.templateId !== undefined ? { templateId: input.templateId } : {}),
    },
    include: projectInclude,
  });
  return toSummary(row);
}

/**
 * Hapus project beserta seluruh isinya. Vektor & objek R2 dibersihkan lebih
 * dulu (best-effort); row DB dihapus setelahnya agar cascade tetap berjalan.
 */
export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: {
      id: true,
      documents: { select: { id: true, objectKey: true } },
    },
  });
  if (!project) return false;

  await Promise.all(
    project.documents.flatMap((document) => [
      deleteDocumentVectors(document.id).catch((error: unknown) =>
        console.warn("Failed to delete project document vectors", {
          documentId: document.id,
          error: error instanceof Error ? error.message : error,
        }),
      ),
      deleteDocument(document.objectKey).catch((error: unknown) =>
        console.warn("Failed to delete project document object", {
          documentId: document.id,
          error: error instanceof Error ? error.message : error,
        }),
      ),
    ]),
  );

  await prisma.project.delete({ where: { id: project.id } });
  return true;
}

/** Project default "Inbox" per user; dibuat saat pertama dibutuhkan. */
export async function ensureDefaultProject(userId: string): Promise<ProjectSummary> {
  const existing = await prisma.project.findFirst({
    where: { userId, isDefault: true },
    include: projectInclude,
  });
  if (existing) return toSummary(existing);

  try {
    const row = await prisma.project.create({
      data: { userId, name: DEFAULT_PROJECT_NAME, isDefault: true },
      include: projectInclude,
    });
    return toSummary(row);
  } catch {
    // Balapan dua request pertama: pakai project yang sudah dibuat pihak lain.
    const raced = await prisma.project.findFirst({
      where: { userId, isDefault: true },
      include: projectInclude,
    });
    if (!raced) throw new Error("Failed to provision the default project");
    return toSummary(raced);
  }
}
