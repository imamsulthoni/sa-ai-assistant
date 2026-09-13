import { Hono } from "hono";
import { z } from "zod";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import {
  BrdClarifySchema,
  BrdCreateSchema,
  BrdDiffQuerySchema,
  BrdImportSchema,
  BrdRestoreSchema,
  BrdSubmitClarificationSchema,
  BrdVersionCreateSchema,
} from "../../lib/api-contract.js";
import { bodyOf, buildPdf, filename } from "./utils.js";
import {
  addBrdVersion,
  approveBrdModification,
  clarifyFlow,
  createBrd,
  deleteBrd,
  diffBrdVersions,
  getBrd,
  getBrdForExport,
  importBrdFromDocument,
  listBrds,
  rejectBrdModification,
  restoreBrdVersion,
  submitClarificationFlow,
  updateBrd,
} from "./services.js";

const owner = (c: { req: { header(name: string): string | undefined } }) => resolveUserId(c.req.header(USER_ID_HEADER));
const session = (c: { req: { header(name: string): string | undefined } }) => c.req.header(CONVERSATION_ID_HEADER)?.trim();

export const brdModule = new Hono()
  .post("/clarify", async (c) => {
    const parsed = BrdClarifySchema.safeParse(await bodyOf(c));
    const sessionId = session(c);
    if (!parsed.success || !sessionId) return c.json({ error: "Invalid clarification payload or missing conversation id" }, 400);
    try { return c.json(await clarifyFlow({ userId: owner(c), sessionId }, parsed.data)); }
    catch (error) { return c.json({ error: error instanceof Error ? error.message : "Unable to clarify BRD" }, 503); }
  })
  .post("/submit-clarification", async (c) => {
    const parsed = BrdSubmitClarificationSchema.safeParse(await bodyOf(c));
    const sessionId = session(c);
    if (!parsed.success || !sessionId) return c.json({ error: "Invalid clarification submission or missing conversation id" }, 400);
    try { return c.json(await submitClarificationFlow({ userId: owner(c), sessionId }, parsed.data)); }
    catch (error) { return c.json({ error: error instanceof Error ? error.message : "Unable to submit clarification" }, 503); }
  })
  .post("/:id/approve-modification", async (c) => {
    const result = await approveBrdModification(owner(c), c.req.param("id"));
    return result ? c.json(result) : c.json({ error: "No pending BRD modification" }, 404);
  })
  .post("/:id/reject-modification", async (c) => {
    const result = await rejectBrdModification(owner(c), c.req.param("id"));
    return result ? c.json({ ok: true }) : c.json({ error: "No pending BRD modification" }, 404);
  })
  .post("/", async (c) => {
    const parsed = BrdCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success) return c.json({ error: "Invalid BRD payload", issues: parsed.error.issues }, 400);
    return c.json({ brd: await createBrd(owner(c), parsed.data) }, 201);
  })
  .post("/import", async (c) => {
    const parsed = BrdImportSchema.safeParse(await bodyOf(c));
    if (!parsed.success) return c.json({ error: "Invalid BRD import payload", issues: parsed.error.issues }, 400);
    const brd = await importBrdFromDocument(owner(c), parsed.data);
    return brd ? c.json({ brd }, 201) : c.json({ error: "Document is not ready or has no extracted content" }, 404);
  })
  .get("/", async (c) => c.json({ brds: await listBrds(owner(c), c.req.query("sessionId") ?? undefined) }))
  .get("/:id", async (c) => {
    const brd = await getBrd(owner(c), c.req.param("id"));
    return brd ? c.json({ brd }) : c.json({ error: "BRD not found" }, 404);
  })
  .patch("/:id", async (c) => {
    const input = BrdVersionCreateSchema.extend({ title: BrdCreateSchema.shape.title.optional(), status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED"]).optional() }).safeParse(await bodyOf(c));
    if (!input.success) return c.json({ error: "Invalid BRD update payload", issues: input.error.issues }, 400);
    const updated = await updateBrd(owner(c), c.req.param("id"), input.data);
    return updated ? c.json({ brd: updated }) : c.json({ error: "BRD not found" }, 404);
  })
  .delete("/:id", async (c) => {
    const ok = await deleteBrd(owner(c), c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "BRD not found" }, 404);
  })
  .post("/:id/versions", async (c) => {
    const parsed = BrdVersionCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success) return c.json({ error: "Invalid BRD version payload", issues: parsed.error.issues }, 400);
    const version = await addBrdVersion(owner(c), c.req.param("id"), parsed.data);
    return version ? c.json({ version }, 201) : c.json({ error: "BRD not found" }, 404);
  })
  .get("/:id/diff", async (c) => {
    const parsed = BrdDiffQuerySchema.safeParse({ from: c.req.query("from"), to: c.req.query("to") });
    if (!parsed.success) return c.json({ error: "from and to version numbers are required", issues: parsed.error.issues }, 400);
    const diff = await diffBrdVersions(owner(c), c.req.param("id"), parsed.data.from, parsed.data.to);
    return diff ? c.json(diff) : c.json({ error: "Version not found" }, 404);
  })
  .post("/:id/restore", async (c) => {
    const parsed = BrdRestoreSchema.safeParse(await bodyOf(c));
    if (!parsed.success) return c.json({ error: "A positive version number is required", issues: parsed.error.issues }, 400);
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
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${filename(brd.title, "pdf")}"`);
    return c.body(buildPdf(brd.contentMarkdown));
  });
