import { Hono } from "hono";
import { z } from "zod";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import {
  BrdClarifySchema,
  BrdCreateSchema,
  BrdDiffQuerySchema,
  BrdImportSchema,
  BrdRestoreSchema,
  BrdStatusSchema,
  BrdSubmitClarificationSchema,
  BrdVersionCreateSchema,
} from "../../lib/api-contract.js";
import { getProject } from "../project/service.js";
import { sessionProjectId } from "../session/service.js";
import { bodyOf, filename } from "./utils.js";
import { renderBrdPdf } from "./pdf.js";
import {
  addBrdVersion,
  approveBrdModification,
  changeBrdStatus,
  clarifyFlow,
  createBrd,
  diffBrdVersions,
  findBrdByProject,
  getBrd,
  getBrdForExport,
  importBrdFromDocument,
  importPendingBrd,
  listBrds,
  rejectBrdModification,
  restoreBrdVersion,
  submitClarificationFlow,
  updateBrd,
} from "./services.js";
import { clearPendingImport, getBrdFlow } from "./flow-state.js";

const owner = (c: { req: { header(name: string): string | undefined } }) =>
  resolveUserId(c.req.header(USER_ID_HEADER));
const session = (c: { req: { header(name: string): string | undefined } }) =>
  c.req.header(CONVERSATION_ID_HEADER)?.trim();

async function projectForSession(
  userId: string,
  sessionId: string | undefined,
): Promise<string | null> {
  if (!sessionId) return null;
  return sessionProjectId(userId, sessionId);
}

export const brdModule = new Hono()
  .post("/clarify", async (c) => {
    const parsed = BrdClarifySchema.safeParse(await bodyOf(c));
    const sessionId = session(c);
    if (!parsed.success || !sessionId)
      return c.json({ error: "Invalid clarification payload or missing conversation id" }, 400);
    const projectId = await projectForSession(owner(c), sessionId);
    if (!projectId) return c.json({ error: "Session is not attached to a project" }, 400);
    try {
      return c.json(
        await clarifyFlow({ userId: owner(c), projectId, sessionId }, parsed.data),
      );
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Unable to clarify BRD" },
        503,
      );
    }
  })
  .post("/submit-clarification", async (c) => {
    const parsed = BrdSubmitClarificationSchema.safeParse(await bodyOf(c));
    const sessionId = session(c);
    if (!parsed.success || !sessionId)
      return c.json({ error: "Invalid clarification submission or missing conversation id" }, 400);
    const projectId = await projectForSession(owner(c), sessionId);
    if (!projectId) return c.json({ error: "Session is not attached to a project" }, 400);
    try {
      return c.json(
        await submitClarificationFlow({ userId: owner(c), projectId, sessionId }, parsed.data),
      );
    } catch (error) {
      return c.json(
        { error: error instanceof Error ? error.message : "Unable to submit clarification" },
        503,
      );
    }
  })
  // Registered before the "/:id" routes so the literal path wins.
  .get("/flow", async (c) => {
    const userId = owner(c);
    const queryProjectId = c.req.query("projectId")?.trim();
    const sessionId = c.req.query("sessionId")?.trim() || session(c);
    const projectId = queryProjectId
      ? (await getProject(userId, queryProjectId))?.id
      : await projectForSession(userId, sessionId);
    if (!projectId) return c.json({ error: "A project id is required" }, 400);
    return c.json({ flow: await getBrdFlow({ userId, projectId, sessionId }) });
  })
  .post("/flow/pending-import", async (c) => {
    const userId = owner(c);
    const sessionId = session(c);
    if (!sessionId) return c.json({ error: "A conversation id is required" }, 400);
    const projectId = await projectForSession(userId, sessionId);
    if (!projectId) return c.json({ error: "Session is not attached to a project" }, 400);
    const result = await importPendingBrd(userId, projectId, sessionId);
    if (result.ok) return c.json({ brd: result.brd });
    if (result.reason === "not_found") return c.json({ error: "No pending import" }, 404);
    if (result.reason === "in_progress")
      return c.json({ error: "Import already in progress" }, 409);
    return c.json({ error: `Dokumen belum siap (${result.status})`, status: result.status }, 409);
  })
  .delete("/flow/pending-import", async (c) => {
    const userId = owner(c);
    const sessionId = session(c);
    if (!sessionId) return c.json({ error: "A conversation id is required" }, 400);
    const projectId = await projectForSession(userId, sessionId);
    if (!projectId) return c.json({ error: "Session is not attached to a project" }, 400);
    await clearPendingImport({ userId, projectId, sessionId });
    return c.json({ ok: true });
  })
  .post("/:id/approve-modification", async (c) => {
    const result = await approveBrdModification(owner(c), c.req.param("id"));
    return result ? c.json(result) : c.json({ error: "No pending BRD modification" }, 404);
  })
  .post("/:id/reject-modification", async (c) => {
    const result = await rejectBrdModification(owner(c), c.req.param("id"));
    return result ? c.json({ brd: result }) : c.json({ error: "No pending BRD modification" }, 404);
  })
  .post("/:id/status", async (c) => {
    const parsed = BrdStatusSchema.safeParse(await bodyOf(c));
    if (!parsed.success) {
      return c.json({ error: "Invalid BRD status payload", issues: parsed.error.issues }, 400);
    }
    const result = await changeBrdStatus(owner(c), c.req.param("id"), parsed.data.status);
    if (!result.ok) {
      if (result.reason === "not_found") return c.json({ error: "BRD not found" }, 404);
      return c.json({ error: `Transisi status tidak diizinkan dari ${result.current}` }, 409);
    }
    return c.json({ brd: result.brd });
  })
  .post("/", async (c) => {
    const parsed = BrdCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json({ error: "Invalid BRD payload", issues: parsed.error.issues }, 400);
    const userId = owner(c);
    const project = await getProject(userId, parsed.data.projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);
    const existing = await findBrdByProject(userId, project.id);
    if (existing) {
      return c.json(
        { error: "Project already has a BRD", code: "brd_exists", brd: existing },
        409,
      );
    }
    if (parsed.data.sessionId) {
      const sessionProject = await projectForSession(userId, parsed.data.sessionId);
      if (sessionProject !== project.id) {
        return c.json({ error: "Session does not belong to this project" }, 400);
      }
    }
    return c.json({ brd: await createBrd(userId, parsed.data) }, 201);
  })
  .post("/import", async (c) => {
    const parsed = BrdImportSchema.safeParse(await bodyOf(c));
    if (!parsed.success) {
      return c.json({ error: "Invalid BRD import payload", issues: parsed.error.issues }, 400);
    }
    const userId = owner(c);
    const project = await getProject(userId, parsed.data.projectId);
    if (!project) return c.json({ error: "Project not found" }, 404);
    const existing = await findBrdByProject(userId, project.id);
    if (existing) {
      return c.json(
        { error: "Project already has a BRD", code: "brd_exists", brd: existing },
        409,
      );
    }
    const brd = await importBrdFromDocument(userId, parsed.data);
    return brd
      ? c.json({ brd }, 201)
      : c.json({ error: "Document is not ready or has no extracted content" }, 404);
  })
  .get("/", async (c) => {
    const userId = owner(c);
    const queryProjectId = c.req.query("projectId")?.trim();
    const sessionId = c.req.query("sessionId")?.trim();
    const projectId = queryProjectId
      ? (await getProject(userId, queryProjectId))?.id
      : await projectForSession(userId, sessionId);
    return c.json({ brds: await listBrds(userId, projectId ?? undefined) });
  })
  .get("/:id", async (c) => {
    const brd = await getBrd(owner(c), c.req.param("id"));
    return brd ? c.json({ brd }) : c.json({ error: "BRD not found" }, 404);
  })
  .patch("/:id", async (c) => {
    const input = BrdVersionCreateSchema.extend({
      title: BrdCreateSchema.shape.title.optional(),
      status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED"]).optional(),
    }).safeParse(await bodyOf(c));
    if (!input.success)
      return c.json({ error: "Invalid BRD update payload", issues: input.error.issues }, 400);
    const updated = await updateBrd(owner(c), c.req.param("id"), input.data);
    return updated ? c.json({ brd: updated }) : c.json({ error: "BRD not found" }, 404);
  })
  // Tidak ada DELETE /:id: BRD hanya terhapus bersama project-nya.
  .post("/:id/versions", async (c) => {
    const parsed = BrdVersionCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json({ error: "Invalid BRD version payload", issues: parsed.error.issues }, 400);
    const version = await addBrdVersion(owner(c), c.req.param("id"), parsed.data);
    return version ? c.json({ version }, 201) : c.json({ error: "BRD not found" }, 404);
  })
  .get("/:id/diff", async (c) => {
    const parsed = BrdDiffQuerySchema.safeParse({
      from: c.req.query("from"),
      to: c.req.query("to"),
    });
    if (!parsed.success)
      return c.json(
        { error: "from and to version numbers are required", issues: parsed.error.issues },
        400,
      );
    const diff = await diffBrdVersions(
      owner(c),
      c.req.param("id"),
      parsed.data.from,
      parsed.data.to,
    );
    return diff ? c.json(diff) : c.json({ error: "Version not found" }, 404);
  })
  .post("/:id/restore", async (c) => {
    const parsed = BrdRestoreSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json(
        { error: "A positive version number is required", issues: parsed.error.issues },
        400,
      );
    const restored = await restoreBrdVersion(owner(c), c.req.param("id"), parsed.data.version);
    return restored ? c.json(restored) : c.json({ error: "BRD or version not found" }, 404);
  })
  .get("/:id/export/markdown", async (c) => {
    const brd = await getBrdForExport(owner(c), c.req.param("id"));
    if (!brd) return c.json({ error: "BRD not found" }, 404);
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename(brd.title, "md")}"`);
    return c.body(brd.contentMarkdown);
  })
  .get("/:id/export/pdf", async (c) => {
    const brd = await getBrdForExport(owner(c), c.req.param("id"));
    if (!brd) return c.json({ error: "BRD not found" }, 404);
    const pdf = await renderBrdPdf({
      title: brd.title,
      version: brd.currentVersion,
      status: brd.status,
      updatedAt: brd.updatedAt,
      contentMarkdown: brd.contentMarkdown,
    });
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${filename(brd.title, "pdf")}"`);
    return c.body(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer);
  });