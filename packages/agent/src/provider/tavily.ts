import { tavily } from "@tavily/core";

export interface TavilySearchResult {
  title: string;
  url: string;
  text?: string;
}

export interface TavilyProvider {
  search(query: string): Promise<readonly TavilySearchResult[]>;
  extract(url: string): Promise<unknown>;
}

export interface TavilyProviderOptions {
  apiKey?: string;
}

export function createTavilyProvider(
  options: TavilyProviderOptions = {},
): TavilyProvider {
  const apiKey = options.apiKey ?? process.env.TAVILY_API_KEY;
  const client = apiKey ? tavily({ apiKey }) : undefined;
  return {
    async search(query) {
      if (!client) return [];

      const response = await client.search(query, {
        searchDepth: "basic",
        includeAnswer: false,
      });

      return response.results.map((result) => ({
        title: result.title ?? result.url,
        url: result.url,
        text: result.content,
      }));
    },
    async extract(url) {
      if (!client) return [];
      return client.extract([url]);
    },
  };
}

export interface ContextChunk {
  id: string;
  text: string;
  source: string;
  score?: number;
}

export interface ContextRetriever {
  retrieve(query: string, options?: { limit?: number; sessionId?: string }): Promise<readonly ContextChunk[]>;
}

export function createContextRetriever(
  retrieve: ContextRetriever["retrieve"],
): ContextRetriever {
  return {
    async retrieve(query, options) {
      const normalized = query.trim();
      if (!normalized) return [];
      const chunks = await retrieve(normalized, options);
      return chunks
        .filter((chunk) => chunk.text.trim() && chunk.source.trim())
        .slice(0, Math.max(1, Math.min(options?.limit ?? 8, 20)));
    },
  };
}
