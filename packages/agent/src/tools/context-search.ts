import { createTool } from "@anvia/core";
import { z } from "zod";
import type { ExaProvider } from "../provider/exa.js";

export function createContextSearchTool(exa: ExaProvider) {
  return createTool({
    name: "search_internal_context",
    description: "Find relevant internal or supplied reference documents before drafting requirements.",
    inputSchema: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => exa.search(query),
  });
}
