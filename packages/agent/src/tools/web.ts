import { createTool } from "@anvia/core";
import { z } from "zod";
import type { TavilyProvider } from "../provider/tavily.js";

export function webTools(tavily: TavilyProvider) {
  let usageCount = 0;
  const maxUsage = 5;
  const webSearch = createTool({
    name: "web_search",
    description: "Search public web information only; never send private BRD or document content.",
    inputSchema: z.object({
      query: z.string().meta({ description: "The query to search" }),
    }),
    execute: ({ query }) => {
      if (usageCount >= maxUsage) return [];
      usageCount += 1;
      const redacted = query
        .replace(
          /(?:brd|document|system prompt|internal|private|confidential)\s*[:=]?[^\n]{0,200}/gi,
          "",
        )
        .trim();
      if (
        redacted.length < 3 ||
        redacted.length > 300 ||
        /ignore previous|reveal|api key|secret/i.test(redacted)
      )
        return [];
      return tavily.search(redacted);
    },
  });

  return [webSearch];
}
