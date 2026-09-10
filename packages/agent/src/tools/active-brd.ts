import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";

export function createActiveBrdTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "get_active_brd",
    description: "Read the selected BRD and its versions without modifying it.",
    inputSchema: z.object({
      userId: z.string().min(1),
      sessionId: z.string().min(1),
      brdId: z.string().min(1).optional(),
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
