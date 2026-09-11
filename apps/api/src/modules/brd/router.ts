import { Hono } from "hono";
import { z } from "zod";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { prisma } from "../../lib/prisma.js";
import {
  BrdCreateSchema,
  BrdDiffQuerySchema,
  BrdRestoreSchema,
  BrdVersionCreateSchema,
} from "../../lib/api-contract.js";

const owner = (c: { req: { header(name: string): string | undefined } }) =>
  resolveUserId(c.req.header(USER_ID_HEADER));
const bodyOf = async (c: any) => (await c.req.json().catch(() => null)) as unknown;

function simpleDiff(before: string, after: string) {
  const oldLines = before.split("\n");
  const newLines = after.split("\n");
  const output = ["--- before", "+++ after"];
  for (let index = 0; index < Math.max(oldLines.length, newLines.length); index++) {
    if (oldLines[index] !== newLines[index]) {
      if (oldLines[index] !== undefined) output.push(`-${oldLines[index]}`);
      if (newLines[index] !== undefined) output.push(`+${newLines[index]}`);
    }
  }
  return output.join("\n");
}

const filename = (title: string, extension: string) =>
  `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "brd"}.${extension}`;

export const brdModule = new Hono()
  .post("/", async (c) => {
    const body = await bodyOf(c);
    const parsed = BrdCreateSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Invalid BRD payload", issues: parsed.error.issues }, 400);
    const input = parsed.data;
    const brd = await prisma.brdDocument.create({
      data: {
        userId: owner(c),
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
    return c.json({ brd }, 201);
  })
  .get("/", async (c) =>
    c.json({
      brds: await prisma.brdDocument.findMany({
        where: {
          userId: owner(c),
          ...(c.req.query("sessionId") ? { sessionId: c.req.query("sessionId") } : {}),
        },
        orderBy: { updatedAt: "desc" },
      }),
    }),
  )
  .get("/:id", async (c) => {
    const brd = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
      include: { versions: { orderBy: { versionNumber: "asc" } } },
    });
    return brd ? c.json({ brd }) : c.json({ error: "BRD not found" }, 404);
  })
  .patch("/:id", async (c) => {
    const body = await bodyOf(c);
    const input = BrdVersionCreateSchema.extend({
      title: BrdCreateSchema.shape.title.optional(),
      status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED"]).optional(),
    }).safeParse(body);
    if (!input.success)
      return c.json({ error: "Invalid BRD update payload", issues: input.error.issues }, 400);
    const current = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
    });
    if (!current) return c.json({ error: "BRD not found" }, 404);
    const nextContent = input.data.contentMarkdown;
    const updated = await prisma.$transaction(async (tx) => {
      let currentVersion = current.currentVersion;
      if (nextContent !== current.contentMarkdown) {
        currentVersion += 1;
        await tx.brdVersion.create({
          data: {
            brdDocumentId: current.id,
            versionNumber: currentVersion,
            contentMarkdown: nextContent,
            changeSummary: input.data.changeSummary ?? "Updated BRD",
            createdBy: input.data.createdBy,
          },
        });
      }
      return tx.brdDocument.update({
        where: { id: current.id },
        data: {
          ...(input.data.title ? { title: input.data.title } : {}),
          ...(input.data.status ? { status: input.data.status } : {}),
          ...(nextContent !== current.contentMarkdown
            ? { contentMarkdown: nextContent, currentVersion }
            : {}),
        },
        include: { versions: { orderBy: { versionNumber: "asc" } } },
      });
    });
    return c.json({ brd: updated });
  })
  .delete("/:id", async (c) => {
    const deleted = await prisma.brdDocument.deleteMany({
      where: { id: c.req.param("id"), userId: owner(c) },
    });
    return deleted.count ? c.json({ ok: true }) : c.json({ error: "BRD not found" }, 404);
  })
  .post("/:id/versions", async (c) => {
    const body = await bodyOf(c);
    const parsed = BrdVersionCreateSchema.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "Invalid BRD version payload", issues: parsed.error.issues }, 400);
    const input = parsed.data;
    const current = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
    });
    if (!current) return c.json({ error: "BRD not found" }, 404);
    const version = await prisma.$transaction(async (tx) => {
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
    const { from, to } = parsedQuery.data;
    const versions = await prisma.brdVersion.findMany({
      where: {
        brdDocumentId: c.req.param("id"),
        brdDocument: { userId: owner(c) },
        versionNumber: { in: [from, to] },
      },
    });
    const before = versions.find((item) => item.versionNumber === from);
    const after = versions.find((item) => item.versionNumber === to);
    if (!before || !after) return c.json({ error: "Version not found" }, 404);
    return c.json({ from, to, diff: simpleDiff(before.contentMarkdown, after.contentMarkdown) });
  })
  .post("/:id/restore", async (c) => {
    const body = await bodyOf(c);
    const parsed = BrdRestoreSchema.safeParse(body);
    if (!parsed.success)
      return c.json(
        { error: "A positive version number is required", issues: parsed.error.issues },
        400,
      );
    const versionNumber = parsed.data.version;
    const current = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
      include: { versions: true },
    });
    const version = current?.versions.find((item) => item.versionNumber === versionNumber);
    if (!current || !version) return c.json({ error: "BRD or version not found" }, 404);
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
    return c.json({ currentVersion: number, contentMarkdown: version.contentMarkdown });
  })
  .get("/:id/export/markdown", async (c) => {
    const brd = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
    });
    if (!brd) return c.json({ error: "BRD not found" }, 404);
    c.header("Content-Type", "text/markdown; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename(brd.title, "md")}"`);
    return c.body(brd.contentMarkdown);
  })
  .get("/:id/export/pdf", async (c) => {
    const brd = await prisma.brdDocument.findFirst({
      where: { id: c.req.param("id"), userId: owner(c) },
    });
    if (!brd) return c.json({ error: "BRD not found" }, 404);
    const text = brd.contentMarkdown
      .replace(/[()\\]/g, "\\$&")
      .replace(/\r?\n/g, "\\n")
      .slice(0, 6000);
    const pdf = `%PDF-1.4\n1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n4 0 obj<< /Length ${text.length + 44} >>stream\nBT /F1 10 Tf 40 750 Td (${text}) Tj ET\nendstream endobj\n5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF`;
    c.header("Content-Type", "application/pdf");
    c.header("Content-Disposition", `attachment; filename="${filename(brd.title, "pdf")}"`);
    return c.body(pdf);
  });
