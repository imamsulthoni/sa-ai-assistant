import { Hono } from "hono";
import { z } from "zod";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import {
  BrdCreateSchema,
  BrdDiffQuerySchema,
  BrdRestoreSchema,
  BrdVersionCreateSchema,
} from "../../lib/api-contract.js";
import { bodyOf, buildPdf, filename } from "./utils.js";
import {
  addBrdVersion,
  createBrd,
  deleteBrd,
  diffBrdVersions,
  getBrd,
  getBrdForExport,
  listBrds,
  restoreBrdVersion,
  updateBrd,
} from "./services.js";

const owner = (c: { req: { header(name: string): string | undefined } }) =>
  resolveUserId(c.req.header(USER_ID_HEADER));

export const brdModule = new Hono()
  .post("/", async (c) => {
    const parsed = BrdCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json({ error: "Invalid BRD payload", issues: parsed.error.issues }, 400);
    const brd = await createBrd(owner(c), parsed.data);
    return c.json({ brd }, 201);
  })
  .get("/", async (c) =>
    c.json({
      brds: await listBrds(owner(c), c.req.query("sessionId") ?? undefined),
    }),
  )
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
    if (!updated) return c.json({ error: "BRD not found" }, 404);
    return c.json({ brd: updated });
  })
  .delete("/:id", async (c) => {
    const ok = await deleteBrd(owner(c), c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "BRD not found" }, 404);
  })
  .post("/:id/versions", async (c) => {
    const parsed = BrdVersionCreateSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json({ error: "Invalid BRD version payload", issues: parsed.error.issues }, 400);
    const version = await addBrdVersion(owner(c), c.req.param("id"), parsed.data);
    if (!version) return c.json({ error: "BRD not found" }, 404);
    return c.json({ version }, 201);
  })
  .get("/:id/diff", async (c) => {
    const parsedQuery = BrdDiffQuerySchema.safeParse({
      from: c.req.query("from"),
      to: c.req.query("to"),
    });
    if (!parsedQuery.success)
      return c.json(
        { error: "from and to version numbers are required", issues: parsedQuery.error.issues },
        400,
      );
    const diff = await diffBrdVersions(
      owner(c),
      c.req.param("id"),
      parsedQuery.data.from,
      parsedQuery.data.to,
    );
    if (!diff) return c.json({ error: "Version not found" }, 404);
    return c.json(diff);
  })
  .post("/:id/restore", async (c) => {
    const parsed = BrdRestoreSchema.safeParse(await bodyOf(c));
    if (!parsed.success)
      return c.json(
        { error: "A positive version number is required", issues: parsed.error.issues },
        400,
      );
    const restored = await restoreBrdVersion(owner(c), c.req.param("id"), parsed.data.version);
    if (!restored) return c.json({ error: "BRD or version not found" }, 404);
    return c.json(restored);
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
