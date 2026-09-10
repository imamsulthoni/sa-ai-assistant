import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { documentQueue, flowchartQueue, retryPolicies } from "../../lib/queue.js";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_SIZE, UploadDocumentSchema } from "./schema.js";
import { deleteDocument, documentUrl, uploadDocument } from "./services.js";
import { documentFileType } from "./types.js";

export const documentModule = new Hono()
  .get("/", async (c) => {
    const userId = resolveUserId(c.req.header(USER_ID_HEADER));
    const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();

    if (!sessionId) return c.json({ documents: [] });

    const documents = await prisma.document.findMany({
      where: { userId, sessionId },
      orderBy: { createdAt: "desc" },
    });

    return c.json({ documents });
  })
  .post("/", async (c) => {
    const userId = resolveUserId(c.req.header(USER_ID_HEADER));
    const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();
    if (!sessionId) {
      return c.json({ error: "A conversation id is required" }, 400);
    }

    const form = await c.req.formData();
    const parsed = UploadDocumentSchema.safeParse({ file: form.get("file") });
    if (!parsed.success) return c.json({ error: "A file is required" }, 400);

    const file = parsed.data.file;
    if (file.size > MAX_DOCUMENT_SIZE) {
      return c.json({ error: "The file exceeds the upload size limit" }, 413);
    }

    if (file.type && !DOCUMENT_MIME_TYPES.has(file.type)) {
      return c.json({ error: "This file type is not supported" }, 415);
    }

    const objectKey = await uploadDocument(file);
    const storageUrl = documentUrl(objectKey);
    const document = await prisma.document.create({
      data: {
        userId,
        sessionId,
        title: file.name,
        fileType: documentFileType(file),
        storageUrl,
        objectKey,
        fileSize: file.size,
        isTemplate: form.get("isTemplate") === "true",
        status: "UPLOADING",
      },
    });

    try {
      const brdDocumentId = form.get("brdDocumentId")?.toString().trim() || undefined;
      if (document.fileType === "IMAGE_FLOWCHART") {
        await flowchartQueue.add(
          "verify-flowchart",
          { documentId: document.id, objectKey, brdDocumentId },
          { ...retryPolicies.flowchart, removeOnComplete: 100, removeOnFail: 100 },
        );
      } else {
        await documentQueue.add(
          "process-document",
          { documentId: document.id, objectKey },
          { ...retryPolicies.ingestion, removeOnComplete: 100, removeOnFail: 100 },
        );
      }
    } catch (error) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: "FAILED",
          error:
            error instanceof Error
              ? error.message.slice(0, 1000)
              : "Failed to enqueue document processing",
        },
      });
      return c.json({ error: "Failed to enqueue document processing" }, 503);
    }

    return c.json({ document }, 201);
  })
  .get("/:id", async (c) => {
    const userId = resolveUserId(c.req.header(USER_ID_HEADER));
    const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();
    const document = await prisma.document.findFirst({
      where: { id: c.req.param("id"), userId, ...(sessionId ? { sessionId } : {}) },
      select: {
        id: true,
        title: true,
        fileType: true,
        isTemplate: true,
        status: true,
        summary: true,
        ocrResult: true,
        templateStructure: true,
        report: true,
        error: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!document) return c.json({ error: "Document not found" }, 404);
    return c.json({ document });
  })
  .delete("/:id", async (c) => {
    const userId = resolveUserId(c.req.header(USER_ID_HEADER));
    const id = c.req.param("id");
    const document = await prisma.document.findFirst({ where: { id, userId } });
    if (!document) return c.json({ error: "Document not found" }, 404);

    await deleteDocument(document.objectKey);
    await prisma.document.delete({ where: { id: document.id } });
    return c.json({ ok: true });
  });
