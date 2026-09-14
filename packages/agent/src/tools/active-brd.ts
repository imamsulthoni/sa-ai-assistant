import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";

export function createActiveBrdTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "get_active_brd",
    description:
      "Read the selected BRD and its versions without modifying it. The active session and user are resolved automatically from the current conversation — never ask the user for a session ID, user ID, or BRD ID.",
    inputSchema: z.object({
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      brdId: z.string().optional(),
    }),
    execute: async (input) => {
      const brd = await resolved.getActiveBrd(input);
      return brd
        ? { found: true as const, ...brd }
        : { found: false as const, contentMarkdown: null, versions: [] };
    },
  });
}

export const getActiveBrdTool = createActiveBrdTool();
