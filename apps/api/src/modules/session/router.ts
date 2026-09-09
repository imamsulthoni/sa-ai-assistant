import { Hono } from "hono";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import {
  createSession,
  deleteSession,
  getSessionMessages,
  listSessions,
  renameSession,
} from "./service.js";

export const sessionModule = new Hono();

function userIdFrom(c: { req: { header(name: string): string | undefined } }) {
  return resolveUserId(c.req.header(USER_ID_HEADER));
}

sessionModule.get("/", async (c) => {
  const userId = userIdFrom(c);
  const sessions = await listSessions(userId);
  return c.json({ sessions });
});

sessionModule.post("/", async (c) => {
  const userId = userIdFrom(c);
  const body = (await c.req.json().catch(() => null)) as { title?: string } | null;
  const session = await createSession(userId, body?.title);
  return c.json({ session }, 201);
});

sessionModule.get("/:id/messages", async (c) => {
  const userId = userIdFrom(c);
  const sessionId = c.req.param("id");
  const messages = await getSessionMessages(userId, sessionId);
  return c.json({ messages });
});

sessionModule.patch("/:id", async (c) => {
  const userId = userIdFrom(c);
  const sessionId = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as { title?: string } | null;

  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return c.json({ error: "A non-empty title is required" }, 400);
  }

  const session = await renameSession(userId, sessionId, body.title);
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json({ session });
});

sessionModule.delete("/:id", async (c) => {
  const userId = userIdFrom(c);
  const sessionId = c.req.param("id");
  const deleted = await deleteSession(userId, sessionId);
  if (!deleted) return c.json({ error: "Session not found" }, 404);
  return c.json({ ok: true }, 200);
});
