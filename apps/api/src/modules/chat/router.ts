import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import { agentToClientStream, parseClientStreamRequest } from "@anvia/client";
import { createSystemAnalystAgent } from "@sa-ai-assistant/agent";
import { PrismaMemoryStore } from "@anvia/memory-prisma";
import { prisma } from "../../lib/prisma.js";
import {
  CONVERSATION_ID_HEADER,
  USER_ID_HEADER,
  resolveUserId,
} from "../../lib/identity.js";
import { titleSessionFromFirstMessage } from "../session/service.js";

export const chatModule = new Hono();

const memory = new PrismaMemoryStore({
  client: prisma,
  scopeKey: { metadataKeys: ["userId"] },
});

const agent = createSystemAnalystAgent({
  memory: { store: memory, savePolicy: "turn" },
  enableTracing: false,
});

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
