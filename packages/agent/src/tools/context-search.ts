import { createTool } from "@anvia/core";
import { z } from "zod";
import { ContextFilterSchema, contextAdapters, type AgentContextAdapters } from "./context.js";

export function createSearchContextTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "search_context",
    description:
      "Search session-scoped internal document context. The active session and user are resolved automatically from the current conversation — never ask the user for a session ID or user ID.",
    inputSchema: z.object({
      query: z.string().trim().min(1),
      filters: ContextFilterSchema.optional(),
      topK: z.number().int().min(1).max(5).default(5),
    }),
    execute: async ({ query, filters, topK }) => ({
      query,
      filters: filters ?? {},
      results: (await resolved.searchContext({ query, filters: filters ?? {}, topK })).slice(0, topK),
    }),
  });
}

export const searchContextTool = createSearchContextTool();
