import { Hono } from "hono";
import { createClientStreamResponse } from "@anvia/server";
import { agentToClientStream, parseClientStreamRequest } from "@anvia/client";
import { CONVERSATION_ID_HEADER, USER_ID_HEADER, resolveUserId } from "../../lib/identity.js";
import { titleSessionFromFirstMessage } from "../session/service.js";
import { agentFor } from "./services.js";
import { stageBrdModification } from "../brd/services.js";
import type { FlowMetadata } from "./types.js";
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
  const phase = metadata?.brdDocumentId ? "QA" : metadata?.phase;
  const agent = await agentFor(userId, sessionId, phase, metadata?.brdDocumentId);

  const agentStream = agent.stream({
    prompt: { role: "user", content: latest.content },
    session: {
      sessionId,
      userId,
      metadata: { userId },
    },
  });
  const events = agentToClientStream({
    events: (async function* () {
      for await (const event of agentStream) {
        if (event.type === "tool_result" && event.toolName === "modify_brd" && event.output?.type === "json") {
          const output = event.output.value as { updatedMarkdown?: string; changeSummary?: string; userNotice?: string };
          if (output.updatedMarkdown) {
            await stageBrdModification(userId, metadata?.brdDocumentId ?? "", output.updatedMarkdown, output.changeSummary ?? "Pending BRD modification");
            yield { ...event, output: { ...event.output, value: { ...output, persisted: false, userNotice: output.userNotice ?? "BRD berhasil dimodifikasi sebagai preview. Silakan approve di panel BRD." } } };
            continue;
          }
        }
        yield event;
      }
    })(),
    ...(body.metadata === undefined ? {} : { metadata: body.metadata }),
    mapError: () => ({ message: "The run failed", retryable: true }),
  });

  return createClientStreamResponse({ events });
});

