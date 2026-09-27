import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import { agentToClientStream, parseClientStreamRequest } from "@anvia/client";
import { CONVERSATION_ID_HEADER } from "../../lib/identity.js";
import { getAuthUser } from "../../lib/auth.js";
import { sessionProjectId, titleSessionFromFirstMessage } from "../session/service.js";
import { agentFor, attachmentContextBlock } from "./services.js";
import type { FlowMetadata } from "./types.js";
export const chatModule = new Hono();

/** Extract readable text from a message whose content may be a string or an array of parts. */
function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter(
      (part): part is { text: string } =>
        Boolean(part) &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string",
    )
    .map((part) => part.text)
    .join(" ")
    .trim();
}

chatModule.post("/", async (c) => {
  const body = parseClientStreamRequest(await c.req.json());

  if (body.type !== "messages") {
    return c.json({ error: "Only message streams are supported" }, 400);
  }

  const userId = getAuthUser(c).id;
  const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();

  if (!sessionId) {
    return c.json({ error: "A conversation id is required" }, 400);
  }

  const projectId = await sessionProjectId(userId, sessionId);
  if (!projectId) {
    return c.json({ error: "Session is not attached to a project" }, 400);
  }

  const latest = body.messages.at(-1);

  if (!latest || latest.role !== "user") {
    return c.json({ error: "A user message is required" }, 400);
  }

  await titleSessionFromFirstMessage(userId, sessionId, latest.content);

  const metadata = body.metadata as FlowMetadata | undefined;
  const phase = metadata?.brdDocumentId ? "QA" : metadata?.phase;
  const agent = await agentFor(
    { userId, projectId, sessionId },
    phase,
    metadata?.brdDocumentId,
  );

  const attachedFiles = (metadata?.attachedFiles ?? [])
    .filter((name) => typeof name === "string" && name.trim())
    .slice(0, 10);
  const attachedDocumentIds = (metadata?.attachedDocumentIds ?? [])
    .filter((id) => typeof id === "string" && id.trim())
    .slice(0, 5);
  const attachmentBlock = attachedDocumentIds.length
    ? await attachmentContextBlock(userId, projectId, attachedDocumentIds)
    : "";
  const fileInstruction = attachedFiles.length
    ? `[File sesi yang dilampirkan pada pesan ini: ${attachedFiles.join(", ")}. Panggil search_context untuk membaca isinya sebelum menjawab bila relevan.]`
    : "";
  const contextBlock = attachmentBlock || fileInstruction;
  const promptContent = contextBlock
    ? [messageText(latest.content), contextBlock].filter(Boolean).join("\n\n")
    : latest.content;

  const agentStream = agent.stream({
    prompt: { role: "user", content: promptContent },
    session: {
      sessionId,
      userId,
      metadata: { userId },
    },
  });
  // Modifikasi BRD sekarang di-stage langsung oleh modify_brd lewat adapter
  // (apps/api/src/modules/chat/services.ts), jadi stream diteruskan apa adanya.
  const events = agentToClientStream({
    events: agentStream,
    ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
    mapError: () => ({ message: "The run failed", retryable: true }),
  });

  return createClientStreamResponse({ events });
});
