import { z } from "zod";

export const ContextFilterSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

export const ContextChunkSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().nullable().optional(),
  pageNumber: z.number().int().positive().nullable(),
  content: z.string(),
  score: z.number().finite(),
});

export type ContextFilter = z.infer<typeof ContextFilterSchema>;
export type ContextChunk = z.infer<typeof ContextChunkSchema>;

/** Metadata versi BRD — konten penuh sengaja tidak ikut agar hemat token. */
export type ActiveBrdVersion = {
  id: string;
  versionNumber: number;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
};

export type BrdStagingResult =
  | { ok: true }
  | { ok: false; reason: "pending_exists" | "not_found" | "not_supported" };

export interface AgentContextAdapters {
  searchContext?: (input: {
    query: string;
    filters: ContextFilter;
    topK: number;
  }) => Promise<readonly ContextChunk[]> | readonly ContextChunk[];
  getTemplateStructure?: (input: {
    userId?: string;
    sessionId?: string;
    projectId?: string;
  }) => Promise<unknown | null> | unknown | null;
  getActiveBrd?: (input: {
    userId?: string;
    sessionId?: string;
    brdId?: string;
  }) =>
    | Promise<{ contentMarkdown: string; versions: readonly ActiveBrdVersion[] } | null>
    | { contentMarkdown: string; versions: readonly ActiveBrdVersion[] }
    | null;
  /**
   * Stage a computed BRD modification as a pending preview server-side. When
   * configured, modify_brd never returns the full updated markdown to the model.
   */
  stageBrdModification?: (input: {
    updatedMarkdown: string;
    changeSummary: string;
  }) => Promise<BrdStagingResult> | BrdStagingResult;
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
    stageBrdModification:
      adapters.stageBrdModification ?? (() => ({ ok: false, reason: "not_supported" })),
  };
}
