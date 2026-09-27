import { Hono } from "hono";
import { getAuthUser } from "../../lib/auth.js";
import { SearchQuerySchema } from "../../lib/api-contract.js";
import { searchUserContent } from "./services.js";

export const searchModule = new Hono().get("/", async (c) => {
  const parsed = SearchQuerySchema.safeParse({
    q: c.req.query("q"),
    type: c.req.query("type"),
    projectId: c.req.query("projectId"),
    sessionId: c.req.query("sessionId"),
    excludeSession: c.req.query("excludeSession"),
  });
  if (!parsed.success) return c.json({ error: "q is required", issues: parsed.error.issues }, 400);
  const { q, type, projectId, sessionId, excludeSession } = parsed.data;
  const userId = getAuthUser(c).id;
  const results = await searchUserContent(userId, q, type, {
    projectId,
    sessionId,
    excludeSession,
  });
  return c.json({ results });
});