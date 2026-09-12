import { Hono } from "hono";
import { USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import {
  createSession,
  deleteSession,
  getSessionMessages,
  listSessions,
  renameSession,
  updateSession,
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
  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; projectId?: string; templateId?: string }
    | null;
  const session = await createSession(userId, body?.title, {
    projectId: body?.projectId,
    templateId: body?.templateId,
  });
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
  const body = (await c.req.json().catch(() => null)) as
    | { title?: string; projectId?: string | null; templateId?: string | null }
    | null;
  if (!body || (!body.title?.trim() && body.projectId === undefined && body.templateId === undefined)) {
    return c.json({ error: "At least one session field is required" }, 400);
  }
  try {
    const session =
      body.projectId !== undefined || body.templateId !== undefined
        ? await updateSession(userId, sessionId, body)
        : await renameSession(userId, sessionId, body.title ?? "");
    if (!session) return c.json({ error: "Session not found" }, 404);
    return c.json({ session });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Session update failed" }, 400);
  }
});

sessionModule.delete("/:id", async (c) => {
  const userId = userIdFrom(c);
  const sessionId = c.req.param("id");
  const deleted = await deleteSession(userId, sessionId);
  if (!deleted) return c.json({ error: "Session not found" }, 404);
  return c.json({ ok: true }, 200);
});
