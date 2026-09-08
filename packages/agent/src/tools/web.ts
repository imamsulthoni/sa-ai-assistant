import { createTool } from "@anvia/core";
import { z } from "zod";
import type { TavilyProvider } from "../provider/tavily.js";

export function webTools(tavily: TavilyProvider) {
  const webSearch = createTool({
    name: "webSearch",
    description: "Use this when you need to search the internet",
    inputSchema: z.object({
      query: z.string().meta({ description: "The query to search" }),
    }),
    execute: ({ query }) => tavily.search(query),
  });

  const webExtract = createTool({
    name: "webExtract",
    description: "Use this when you need to extract information from a webpage",
    inputSchema: z.object({
      url: z.url().meta({ description: "The URL to extract" }),
    }),
    execute: ({ url }) => tavily.extract(url),
  });

  return [webSearch, webExtract];
}
