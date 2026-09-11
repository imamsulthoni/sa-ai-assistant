import { z } from "zod";

const isoDate = z.coerce.date();

export const BrdCreateSchema = z.object({
  sessionId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  contentMarkdown: z.string().min(1),
  changeSummary: z.string().trim().max(500).optional(),
});

export const BrdVersionCreateSchema = z.object({
  contentMarkdown: z.string().min(1),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  createdBy: z.enum(["AI_AGENT", "USER_MANUAL"]).default("AI_AGENT"),
});

export const BrdRestoreSchema = z.object({
  version: z.coerce.number().int().positive(),
});

export const BrdDiffQuerySchema = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});

// PRD §4H: provider/model/baseUrl/credentials are server-managed (env).
// PATCH /settings only accepts user-editable preferences; any other keys
// sent by older clients are stripped by zod and ignored.
export const SettingsPatchSchema = z.object({
  theme: z.string().trim().min(1).max(40).optional(),
  systemPrompt: z.string().max(20_000).nullable().optional(),
});

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  type: z.enum(["brd", "document"]).optional(),
  excludeSession: z.string().trim().min(1).optional(),
});

export const ErrorResponseSchema = z.object({ error: z.string() });
export const BrdCreateResponseSchema = z.object({
  brd: z
    .object({ id: z.string(), currentVersion: z.number(), contentMarkdown: z.string() })
    .passthrough(),
});
export const BrdVersionResponseSchema = z.object({
  version: z
    .object({ id: z.string(), versionNumber: z.number(), contentMarkdown: z.string() })
    .passthrough(),
});
export const BrdDiffResponseSchema = z.object({
  from: z.number(),
  to: z.number(),
  diff: z.string(),
});
export const SettingsResponseSchema = z.object({ settings: z.unknown().nullable() });
export const SearchResponseSchema = z.object({
  results: z.array(
    z
      .object({
        type: z.enum(["brd", "document"]),
        id: z.string(),
        title: z.string(),
        sessionId: z.string().nullable(),
      })
      .passthrough(),
  ),
});

export const ContractDateSchema = isoDate;

export type BrdCreateInput = z.infer<typeof BrdCreateSchema>;
export type BrdVersionCreateInput = z.infer<typeof BrdVersionCreateSchema>;
export type SettingsPatchInput = z.infer<typeof SettingsPatchSchema>;
