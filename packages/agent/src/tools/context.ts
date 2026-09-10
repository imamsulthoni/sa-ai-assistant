import { z } from "zod";

export const ContextFilterSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
});

export const ContextChunkSchema = z.object({
  documentId: z.string().min(1),
  pageNumber: z.number().int().positive().nullable(),
  content: z.string(),
  score: z.number().finite(),
});

export type ContextFilter = z.infer<typeof ContextFilterSchema>;
export type ContextChunk = z.infer<typeof ContextChunkSchema>;

export interface AgentContextAdapters {
  searchContext?: (input: {
    query: string;
    filters: ContextFilter;
    topK: number;
  }) => Promise<readonly ContextChunk[]> | readonly ContextChunk[];
  getTemplateStructure?: (input: {
    userId: string;
    sessionId: string;
    projectId?: string;
  }) => Promise<unknown | null> | unknown | null;
  getActiveBrd?: (input: {
    userId: string;
    sessionId: string;
    brdId?: string;
  }) =>
    | Promise<{ contentMarkdown: string; versions: readonly unknown[] } | null>
    | { contentMarkdown: string; versions: readonly unknown[] }
    | null;
}

export const DEFAULT_CONTEXT_FILTER: ContextFilter = {
  userId: "unknown-user",
  sessionId: "unknown-session",
};

export function contextAdapters(
  adapters: AgentContextAdapters = {},
): Required<AgentContextAdapters> {
  return {
    searchContext: adapters.searchContext ?? (() => []),
    getTemplateStructure: adapters.getTemplateStructure ?? (() => null),
    getActiveBrd: adapters.getActiveBrd ?? (() => null),
  };
}
