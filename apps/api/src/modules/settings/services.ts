import { prisma } from "../../lib/prisma.js";
import type { SettingsPatchInput } from "../../lib/api-contract.js";
import { documentQueue, retryPolicies } from "../../lib/queue.js";
import { documentUrl, uploadDocument } from "../document/services.js";
import { documentFileType } from "../document/types.js";

export async function getSettings(userId: string) {
  const settings = await prisma.userSetting.findUnique({ where: { userId } });
  return settings
    ? { ...settings, encryptedApiKey: settings.encryptedApiKey ? "********" : null }
    : null;
}

export async function patchSettings(userId: string, input: SettingsPatchInput) {
  // Server-managed fields (aiProvider/aiModel/customBaseUrl/apiKey) are
  // intentionally not writable here — see PRD §4H.
  const data = {
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
  };
  const settings = await prisma.userSetting.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return { ...settings, encryptedApiKey: settings.encryptedApiKey ? "********" : null };
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

export async function getTemplate(userId: string, id: string) {
  return prisma.document.findFirst({
    where: { id, userId, isTemplate: true },
    select: { id: true, title: true, status: true, templateStructure: true, error: true },
  });
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
