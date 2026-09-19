import { Hono } from "hono";
import { prisma } from "../../lib/prisma.js";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { documentQueue, retryPolicies } from "../../lib/queue.js";
import {
  DOCUMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE,
  MAX_BRD_IMPORT_SIZE,
  UploadDocumentSchema,
} from "./schema.js";
import { deleteDocument, deleteDocumentVectors, documentUrl, uploadDocument } from "./services.js";
import { documentFileType } from "./types.js";
import { clearPendingImport, markPendingImport } from "../brd/flow-state.js";
import { getProject } from "../project/service.js";
import { sessionProjectId } from "../session/service.js";

export const documentModule = new Hono()
  .get("/", async (c) => {
    const userId = resolveUserId(c.req.header(USER_ID_HEADER));
    const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();
    const scope = c.req.query("scope")?.trim();
    const queryProjectId = c.req.query("projectId")?.trim();

    // scope=session: hanya file yang diunggah dari percakapan ini.
    if (scope === "session") {
      if (!sessionId) return c.json({ documents: [] });
      const documents = await prisma.document.findMany({
        where: { userId, sessionId },
        orderBy: { createdAt: "desc" },
      });
      return c.json({ documents });
    }

    const projectId = queryProjectId
      ? (await getProject(userId, queryProjectId))?.id
      : sessionId
        ? await sessionProjectId(userId, sessionId)
        : null;
    if (!projectId) return c.json({ documents: [] });

    const documents = await prisma.document.findMany({
      where: { userId, projectId },
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
    const projectId = await sessionProjectId(userId, sessionId);
    if (!projectId) {
      return c.json({ error: "Session is not attached to a project" }, 400);
    }

    const form = await c.req.formData();
    const parsed = UploadDocumentSchema.safeParse({ file: form.get("file") });
    if (!parsed.success) return c.json({ error: "A file is required" }, 400);

    const file = parsed.data.file;
    // BRD import boleh lebih besar (20MB) daripada lampiran biasa (10MB).
    const brdImport = form.get("brdImport") === "true";
    const maxSize = brdImport ? MAX_BRD_IMPORT_SIZE : MAX_ATTACHMENT_SIZE;
    if (file.size > maxSize) {
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
        projectId,
        title: file.name,
        fileType: documentFileType(file),
        storageUrl,
        objectKey,
        fileSize: file.size,
        isTemplate: form.get("isTemplate") === "true",
        status: "UPLOADING",
      },
    });

    // Marked in the same request that creates the document, so an unmount
    // between upload and import can never lose the pending intent.
    if (brdImport) {
      await markPendingImport({ userId, projectId, sessionId }, document.id);
    }

    try {
      await documentQueue.add(
        "process-document",
        { documentId: document.id, objectKey },
        { ...retryPolicies.ingestion, removeOnComplete: 100, removeOnFail: 100 },
      );
    } catch (error) {
      if (brdImport) {
        await clearPendingImport({ userId, projectId, sessionId }).catch(() => undefined);
      }
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
    const document = await prisma.document.findFirst({
      where: { id: c.req.param("id"), userId },
      select: {
        id: true,
        title: true,
        fileType: true,
        isTemplate: true,
        status: true,
        summary: true,
        templateStructure: true,
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

    try {
      await deleteDocumentVectors(document.id);
    } catch (error) {
      console.warn("Failed to delete document vectors", {
        documentId: document.id,
        error: error instanceof Error ? error.message : error,
      });
    }
    await deleteDocument(document.objectKey);
    await prisma.document.delete({ where: { id: document.id } });
    return c.json({ ok: true });
  });