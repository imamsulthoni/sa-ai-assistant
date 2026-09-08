import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import {
  completionToClientStream,
  parseClientStreamRequest,
} from "@anvia/client";
import { createSystemAnalystAgent } from "@sa-ai-assistant/agent";
import { PrismaMemoryStore } from "@anvia/memory-prisma";
import { prisma } from "../../lib/prisma.js";

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

  const sessionId = c.req.query("sessionId") ?? "default";
  const userId = c.req.header("x-user-id");
  const latest = body.messages.at(-1);
  if (!latest || latest.role !== "user") {
    return c.json({ error: "A user message is required" }, 400);
  }

  const agentStream = agent.stream({
    prompt: { role: "user", content: latest.content },
    session: {
      sessionId,
      userId,
      metadata: { userId: userId ?? "anonymous" },
    },
  });
  const events = completionToClientStream({
    events: (async function* () {
      for await (const event of agentStream.events) {
        if (event.type === "text_delta") {
          yield { type: "text_delta", delta: event.delta };
        }
      }
    })(),
  });

  return createClientStreamResponse({ events, format: "sse" });
});
