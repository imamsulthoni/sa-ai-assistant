import { Hono } from "hono";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { SearchQuerySchema } from "../../lib/api-contract.js";
import { searchUserContent } from "./services.js";

export const searchModule = new Hono().get("/", async (c) => {
  const parsed = SearchQuerySchema.safeParse({
    q: c.req.query("q"),
    type: c.req.query("type"),
    excludeSession: c.req.query("excludeSession"),
  });
  if (!parsed.success) return c.json({ error: "q is required", issues: parsed.error.issues }, 400);
  const { q, type, excludeSession } = parsed.data;
  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const results = await searchUserContent(userId, q, type, excludeSession);
  return c.json({ results });
});
