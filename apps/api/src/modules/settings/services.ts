import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import type { SettingsPatchInput } from "../../lib/api-contract.js";
import { encryptSecret } from "../../lib/crypto.js";
import { documentQueue, retryPolicies } from "../../lib/queue.js";
import {
  deleteDocument,
  deleteDocumentVectors,
  documentUrl,
  uploadDocument,
} from "../document/services.js";
import { documentFileType } from "../document/types.js";

function maskSecret(settings: { encryptedApiKey: string | null }) {
  return { ...settings, encryptedApiKey: settings.encryptedApiKey ? "********" : null };
}

/** Default model routing dari env, ditampilkan sebagai placeholder di UI. */
export function modelDefaults() {
  const fallback = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return {
    aiModel: fallback,
    easyModel: process.env.OPENAI_EASY_MODEL || fallback,
    mediumModel: process.env.OPENAI_MEDIUM_MODEL || fallback,
    hardModel: process.env.OPENAI_HARD_MODEL || fallback,
    baseUrl: process.env.OPENAI_BASE_URL || "https://openrouter.ai/api/v1",
  };
}

export function hasServerApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function getSettings(userId: string) {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  return settings ? maskSecret(settings) : null;
}

export async function patchSettings(userId: string, input: SettingsPatchInput) {
  const data = {
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
    ...(input.aiProvider !== undefined ? { aiProvider: input.aiProvider } : {}),
    ...(input.aiModel !== undefined ? { aiModel: input.aiModel || null } : {}),
    ...(input.easyModel !== undefined ? { easyModel: input.easyModel || null } : {}),
    ...(input.mediumModel !== undefined ? { mediumModel: input.mediumModel || null } : {}),
    ...(input.hardModel !== undefined ? { hardModel: input.hardModel || null } : {}),
    ...(input.customBaseUrl !== undefined ? { customBaseUrl: input.customBaseUrl || null } : {}),
    // API key hanya ditimpa saat dikirim; null/kosong menghapus key tersimpan.
    ...(input.apiKey !== undefined
      ? { encryptedApiKey: input.apiKey ? encryptSecret(input.apiKey) : null }
      : {}),
  };
  const settings = await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return maskSecret(settings);
}

export async function uploadTemplate(userId: string, sessionId: string | undefined, file: File) {
  const objectKey = await uploadDocument(file);
  return prisma.document.create({
    data: {
      userId,
      sessionId,
      title: file.name,
      fileType: documentFileType(file),
      storageUrl: documentUrl(objectKey),
      objectKey,
      fileSize: file.size,
      isTemplate: true,
      status: "UPLOADING",
    },
  });
}

export async function enqueueTemplateProcess(documentId: string, objectKey: string) {
  try {
    await documentQueue.add(
      "process-document",
      { documentId, objectKey },
      { ...retryPolicies.ingestion, removeOnComplete: 100, removeOnFail: 100 },
    );
    return true;
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Failed to enqueue template",
      },
    });
    return false;
  }
}

const TEMPLATE_SELECT = {
  id: true,
  title: true,
  status: true,
  templateStructure: true,
  error: true,
} as const;

const IN_FLIGHT_TEMPLATE_STATUSES = ["UPLOADING", "PROCESSING", "PENDING_CONFIRMATION"] as const;

export async function getTemplate(userId: string, id: string) {
  return prisma.document.findFirst({
    where: { id, userId, isTemplate: true },
    select: TEMPLATE_SELECT,
  });
}

/**
 * Template yang paling relevan untuk ditampilkan di Settings: template yang
 * sedang diproses selalu mengalahkan template aktif, supaya progress ekstraksi
 * tidak hilang saat dialog ditutup dan dibuka kembali. `activeTemplateId`
 * dikembalikan terpisah agar klien bisa tahu apakah user sudah punya template
 * aktif (dipakai untuk gating pembuatan BRD).
 */
export type TemplateSummary = {
  id: string;
  title: string;
  status: string;
  hasStructure: boolean;
  sectionCount: number;
  error: string | null;
  updatedAt: string;
};

/** Semua template milik user + id template yang sedang aktif. */
export async function listTemplates(userId: string): Promise<{
  activeTemplateId: string | null;
  templates: TemplateSummary[];
}> {
  const [documents, settings] = await Promise.all([
    prisma.document.findMany({
      where: { userId, isTemplate: true },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        templateStructure: true,
        error: true,
        updatedAt: true,
      },
    }),
    prisma.userSetting.findUnique({
      where: { userId },
      select: { activeTemplateId: true },
    }),
  ]);
  return {
    activeTemplateId: settings?.activeTemplateId ?? null,
    templates: documents.map((document) => {
      const structure = document.templateStructure as { sections?: unknown[] } | null;
      return {
        id: document.id,
        title: document.title,
        status: document.status,
        hasStructure: Boolean(document.templateStructure),
        sectionCount: Array.isArray(structure?.sections) ? structure.sections.length : 0,
        error: document.error,
        updatedAt: document.updatedAt.toISOString(),
      };
    }),
  };
}

/**
 * Hapus satu template. Bila template itu sedang aktif, `activeTemplateId`
 * dikosongkan supaya project yang menunjuknya jatuh ke fallback resolver.
 */
export async function deleteTemplate(userId: string, templateId: string): Promise<boolean> {
  const template = await prisma.document.findFirst({
    where: { id: templateId, userId, isTemplate: true },
    select: { id: true, objectKey: true },
  });
  if (!template) return false;

  // Best-effort: template manual tidak punya objek R2/vektor, dan koleksi
  // Qdrant bisa saja belum ada — penghapusan tetap boleh lanjut.
  await deleteDocumentVectors(template.id).catch((error: unknown) =>
    console.warn("Failed to delete template vectors", {
      documentId: template.id,
      error: error instanceof Error ? error.message : error,
    }),
  );
  await deleteDocument(template.objectKey).catch((error: unknown) =>
    console.warn("Failed to delete template object", {
      objectKey: template.objectKey,
      error: error instanceof Error ? error.message : error,
    }),
  );
  await prisma.$transaction([
    prisma.userSetting.updateMany({
      where: { userId, activeTemplateId: template.id },
      data: { activeTemplateId: null },
    }),
    prisma.document.delete({ where: { id: template.id } }),
  ]);
  return true;
}

export async function getCurrentTemplate(userId: string) {
  const settings = await prisma.userSetting.findUnique({
    where: { userId },
    select: { activeTemplateId: true },
  });
  const activeTemplateId = settings?.activeTemplateId ?? null;

  const inFlight = await prisma.document.findFirst({
    where: {
      userId,
      isTemplate: true,
      status: { in: [...IN_FLIGHT_TEMPLATE_STATUSES] },
    },
    orderBy: { updatedAt: "desc" },
    select: TEMPLATE_SELECT,
  });
  if (inFlight) return { document: inFlight, activeTemplateId };

  if (!activeTemplateId) return { document: null, activeTemplateId: null };

  const document = await prisma.document.findFirst({
    where: { id: activeTemplateId, userId, isTemplate: true },
    select: TEMPLATE_SELECT,
  });
  return { document, activeTemplateId: document ? activeTemplateId : null };
}

/**
 * Template yang disusun manual (tanpa dokumen unggahan): langsung READY dan
 * aktif. `objectKey` sintetis tetap diisi karena kolomnya unik dan wajib,
 * tetapi tidak ada objek R2 yang perlu dibersihkan.
 */
export async function createManualTemplate(
  userId: string,
  input: { title: string; templateStructure: object },
) {
  const document = await prisma.document.create({
    data: {
      userId,
      title: input.title,
      fileType: "MARKDOWN",
      storageUrl: "",
      objectKey: `manual-template-${randomUUID()}.json`,
      fileSize: 0,
      isTemplate: true,
      status: "READY",
      templateStructure: input.templateStructure,
    },
    select: TEMPLATE_SELECT,
  });
  await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, activeTemplateId: document.id },
    update: { activeTemplateId: document.id },
  });
  return document;
}

export async function patchTemplateStructure(
  userId: string,
  templateId: string,
  templateStructure: object,
): Promise<boolean> {
  const updated = await prisma.document.updateMany({
    where: { id: templateId, userId, isTemplate: true },
    data: { templateStructure },
  });
  return updated.count > 0;
}

export async function approveTemplate(userId: string, templateId: string) {
  const document = await prisma.document.findFirst({
    where: { id: templateId, userId, isTemplate: true },
  });
  if (!document) return null;
  await prisma.$transaction([
    prisma.userSetting.upsert({
      where: { userId },
      create: { userId, activeTemplateId: document.id },
      update: { activeTemplateId: document.id },
    }),
    prisma.document.update({ where: { id: document.id }, data: { status: "READY" } }),
  ]);
  return document.id;
}

export async function rejectTemplate(userId: string, templateId: string) {
  const updated = await prisma.document.updateMany({
    where: { id: templateId, userId, isTemplate: true },
    data: { status: "FAILED", error: "Template rejected by user" },
  });
  return updated.count > 0;
}

export async function resetActiveTemplate(userId: string) {
  const settings = await prisma.userSetting.findUnique({
    where: { userId },
    select: { activeTemplateId: true },
  });
  if (!settings?.activeTemplateId) return false;
  const deleted = await deleteTemplate(userId, settings.activeTemplateId);
  if (!deleted) {
    // Template aktif sudah tidak ada; bersihkan pointer-nya.
    await prisma.userSetting.update({ where: { userId }, data: { activeTemplateId: null } });
    return false;
  }
  return true;
}
