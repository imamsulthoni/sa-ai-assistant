import { Exa, type SearchResponse } from "exa-js";

export interface ExaSearchResult {
  title: string;
  url: string;
  text?: string;
}

export interface ExaProvider {
  search(query: string): Promise<readonly ExaSearchResult[]>;
}

export interface ExaProviderOptions {
  apiKey?: string;
}

export function createExaProvider(options: ExaProviderOptions = {}): ExaProvider {
  const apiKey = options.apiKey ?? process.env.EXA_API_KEY;
  if (!apiKey) {
    return {
      async search() {
        return [];
      },
    };
  }

  const client = new Exa(apiKey);
  return {
    async search(query) {
      const response: SearchResponse<{ text: true }> = await client.searchAndContents(query, {
        type: "auto",
        text: true,
        livecrawl: "fallback",
      });

      return response.results.map((result) => ({
        title: result.title ?? result.url,
        url: result.url,
        text: result.text,
      }));
    },
  };
}
