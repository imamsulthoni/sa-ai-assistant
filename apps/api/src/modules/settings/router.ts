import { Hono } from "hono";
import { USER_ID_HEADER, CONVERSATION_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { prisma } from "../../lib/prisma.js";
import { documentQueue, retryPolicies } from "../../lib/queue.js";
import {
  MAX_DOCUMENT_SIZE,
  DOCUMENT_MIME_TYPES,
  UploadDocumentSchema,
} from "../document/schema.js";
import { documentFileType } from "../document/types.js";
import { documentUrl, uploadDocument } from "../document/services.js";
import { SettingsPatchSchema } from "../../lib/api-contract.js";

const user = (c: { req: { header(name: string): string | undefined } }) =>
  resolveUserId(c.req.header(USER_ID_HEADER));

export const settingsModule = new Hono()
  .get("/", async (c) => {
    const settings = await prisma.userSetting.findUnique({ where: { userId: user(c) } });
    return c.json({
      settings: settings
        ? { ...settings, encryptedApiKey: settings.encryptedApiKey ? "********" : null }
        : null,
    });
  })
  .patch("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SettingsPatchSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Invalid settings payload", issues: parsed.error.issues }, 400);
    const input = parsed.data;
    // Server-managed fields (aiProvider/aiModel/customBaseUrl/apiKey) are
    // intentionally not writable here — see PRD §4H.
    const data = {
      ...(input.theme !== undefined ? { theme: input.theme } : {}),
      ...(input.systemPrompt !== undefined ? { systemPrompt: input.systemPrompt } : {}),
    };
    const settings = await prisma.userSetting.upsert({
      where: { userId: user(c) },
      create: { userId: user(c), ...data },
      update: data,
    });
    return c.json({
      settings: { ...settings, encryptedApiKey: settings.encryptedApiKey ? "********" : null },
    });
  })
  .post("/template", async (c) => {
    const form = await c.req.formData();
    const parsed = UploadDocumentSchema.safeParse({ file: form.get("file") });
    if (!parsed.success) return c.json({ error: "A file is required" }, 400);
    const file = parsed.data.file;
    if (file.size > MAX_DOCUMENT_SIZE || (file.type && !DOCUMENT_MIME_TYPES.has(file.type)))
      return c.json({ error: "Unsupported or oversized file" }, 415);
    const owner = user(c);
    const objectKey = await uploadDocument(file);
    const document = await prisma.document.create({
      data: {
        userId: owner,
        sessionId: c.req.header(CONVERSATION_ID_HEADER)?.trim(),
        title: file.name,
        fileType: documentFileType(file),
        storageUrl: documentUrl(objectKey),
        objectKey,
        fileSize: file.size,
        isTemplate: true,
        status: "UPLOADING",
      },
    });
    try {
      await documentQueue.add(
        "process-document",
        { documentId: document.id, objectKey },
        { ...retryPolicies.ingestion, removeOnComplete: 100, removeOnFail: 100 },
      );
    } catch (error) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : "Failed to enqueue template",
        },
      });
      return c.json({ error: "Failed to enqueue template" }, 503);
    }
    return c.json({ document }, 201);
  })
  .get("/template/:id", async (c) => {
    const document = await prisma.document.findFirst({
      where: { id: c.req.param("id"), userId: user(c), isTemplate: true },
      select: { id: true, title: true, status: true, templateStructure: true, error: true },
    });
    return document ? c.json({ document }) : c.json({ error: "Template not found" }, 404);
  })
  .post("/template/:id/approve", async (c) => {
    const document = await prisma.document.findFirst({
      where: { id: c.req.param("id"), userId: user(c), isTemplate: true },
    });
    if (!document) return c.json({ error: "Template not found" }, 404);
    await prisma.$transaction([
      prisma.userSetting.upsert({
        where: { userId: user(c) },
        create: { userId: user(c), activeTemplateId: document.id },
        update: { activeTemplateId: document.id },
      }),
      prisma.document.update({ where: { id: document.id }, data: { status: "READY" } }),
    ]);
    return c.json({ ok: true, activeTemplateId: document.id });
  })
  .post("/template/:id/reject", async (c) => {
    const document = await prisma.document.updateMany({
      where: { id: c.req.param("id"), userId: user(c), isTemplate: true },
      data: { status: "FAILED", error: "Template rejected by user" },
    });
    return document.count ? c.json({ ok: true }) : c.json({ error: "Template not found" }, 404);
  });
