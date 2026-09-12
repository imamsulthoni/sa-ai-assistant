import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import { agentToClientStream, parseClientStreamRequest } from "@anvia/client";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { titleSessionFromFirstMessage } from "../session/service.js";
import { agentFor, clarifyFor, modifyBrd, runBrdFlow } from "./services.js";
import type { FlowMetadata, FlowRequest } from "./types.js";

export const chatModule = new Hono();

chatModule.post("/", async (c) => {
  const body = parseClientStreamRequest(await c.req.json());

  if (body.type !== "messages") {
    return c.json({ error: "Only message streams are supported" }, 400);
  }

  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();

  if (!sessionId) {
    return c.json({ error: "A conversation id is required" }, 400);
  }

  const latest = body.messages.at(-1);

  if (!latest || latest.role !== "user") {
    return c.json({ error: "A user message is required" }, 400);
  }

  await titleSessionFromFirstMessage(userId, sessionId, latest.content);

  const metadata = body.metadata as FlowMetadata | undefined;
  const agent = await agentFor(userId, sessionId, metadata?.phase, metadata?.brdDocumentId);

  const agentStream = agent.stream({
    prompt: { role: "user", content: latest.content },
    session: {
      sessionId,
      userId,
      metadata: { userId },
    },
  });

  const events = agentToClientStream({
    events: agentStream,
    ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
    mapError: () => ({ message: "The run failed", retryable: true }),
  });

  return createClientStreamResponse({ events });
});

chatModule.post("/flow-stream", async (c) => {
  const raw = (await c.req.json().catch(() => null)) as {
    type?: string;
    messages?: Array<{
      role?: string;
      content?: string;
      parts?: Array<{ type?: string; text?: string }>;
    }>;
    metadata?: FlowMetadata;
  } | null;
  const body =
    raw?.type === "messages" && Array.isArray(raw.messages)
      ? {
          type: "messages" as const,
          messages: raw.messages.map((message) => ({
            role: message.role ?? "user",
            content:
              message.content ??
              message.parts
                ?.filter((part) => part.type === "text")
                .map((part) => part.text ?? "")
                .join("\n") ??
              "",
          })),
          metadata: raw.metadata,
        }
      : null;
  if (!body) return c.json({ error: "Invalid message stream request" }, 400);
  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();
  if (!sessionId) return c.json({ error: "A conversation id is required" }, 400);
  if (body.type !== "messages") return c.json({ error: "Only message streams are supported" }, 400);
  const latest = body.messages.at(-1);
  if (!latest || latest.role !== "user")
    return c.json({ error: "A user message is required" }, 400);
  const latestText =
    typeof latest.content === "string" ? latest.content : JSON.stringify(latest.content);
  const metadata = body.metadata as FlowMetadata | undefined;
  if (metadata?.phase === "CLARIFY") {
    const questions = clarifyFor(latestText, 1);
    const events = (async function* () {
      yield {
        type: "data" as const,
        name: "clarification" as const,
        data: { clarification_questions: questions },
        transient: true,
        runId: "clarification",
      };
      yield {
        type: "run_end" as const,
        status: "completed" as const,
        runId: "clarification",
      };
    })();
    return createClientStreamResponse({ events });
  }
  try {
    const agent = await agentFor(userId, sessionId, metadata?.phase, metadata?.brdDocumentId);
    const agentStream = agent.stream({
      prompt: { role: "user", content: latestText },
      session: { sessionId, userId, metadata: { userId } },
    });
    const events = agentToClientStream({
      events: agentStream,
      ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
      mapError: () => ({ message: "The run failed", retryable: true }),
    });
    return createClientStreamResponse({ events });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unable to start BRD stream" },
      503,
    );
  }
});

chatModule.post("/flow", async (c) => {
  const userId = resolveUserId(c.req.header(USER_ID_HEADER));
  const sessionId = c.req.header(CONVERSATION_ID_HEADER)?.trim();
  if (!sessionId) return c.json({ error: "A conversation id is required" }, 400);

  const body = (await c.req.json().catch(() => null)) as FlowRequest | null;
  if (!body) return c.json({ error: "A user story is required" }, 400);

  const result = await runBrdFlow(userId, sessionId, body);
  if ("error" in result) return c.json({ error: result.error }, 400);
  return c.json(result);
});

chatModule.post("/modify", async (c) => {
  const body = (await c.req.json().catch(() => null)) as {
    brd: string;
    changeRequest: string;
    referenceContext?: string;
  } | null;
  if (!body?.brd?.trim() || !body.changeRequest?.trim()) {
    return c.json({ error: "BRD content and change request are required" }, 400);
  }
  return c.json(modifyBrd(body.brd, body.changeRequest, body.referenceContext));
});
