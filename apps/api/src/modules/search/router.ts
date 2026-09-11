import { Hono } from "hono";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { prisma } from "../../lib/prisma.js";
import { SearchQuerySchema } from "../../lib/api-contract.js";

export const searchModule = new Hono().get("/", async (c) => {
  const parsed = SearchQuerySchema.safeParse({
    q: c.req.query("q"),
    type: c.req.query("type"),
    excludeSession: c.req.query("excludeSession"),
  });
  if (!parsed.success) return c.json({ error: "q is required", issues: parsed.error.issues }, 400);
  const { q: query, type, excludeSession } = parsed.data;
  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const contains = { contains: query, mode: "insensitive" as const };
  const results = [] as Array<Record<string, unknown>>;
  if (!type || type === "brd") {
    const brds = await prisma.brdDocument.findMany({
      where: {
        userId,
        title: contains,
        ...(excludeSession ? { NOT: { sessionId: excludeSession } } : {}),
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    results.push(
      ...brds.map((brd) => ({
        type: "brd",
        id: brd.id,
        title: brd.title,
        sessionId: brd.sessionId,
        updatedAt: brd.updatedAt,
      })),
    );
  }
  if (!type || type === "document") {
    const documents = await prisma.document.findMany({
      where: {
        userId,
        title: contains,
        ...(excludeSession ? { NOT: { sessionId: excludeSession } } : {}),
      },
      take: 20,
      orderBy: { updatedAt: "desc" },
    });
    results.push(
      ...documents.map((document) => ({
        type: "document",
        id: document.id,
        title: document.title,
        sessionId: document.sessionId,
        status: document.status,
        updatedAt: document.updatedAt,
      })),
    );
  }
  return c.json({ results });
});
