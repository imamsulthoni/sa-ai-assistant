import { createTool } from "@anvia/core";
import { z } from "zod";
import { ContextFilterSchema, contextAdapters, type AgentContextAdapters } from "./context.js";

export function createSearchContextTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "search_context",
    description: "Search session-scoped internal document context.",
    inputSchema: z.object({
      query: z.string().trim().min(1),
      filters: ContextFilterSchema,
      topK: z.number().int().min(1).max(5).default(5),
    }),
    execute: async ({ query, filters, topK }) => ({
      query,
      filters,
      results: (await resolved.searchContext({ query, filters, topK })).slice(0, topK),
    }),
  });
}

export const searchContextTool = createSearchContextTool();
