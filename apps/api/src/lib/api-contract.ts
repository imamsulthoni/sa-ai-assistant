import { z } from "zod";

const isoDate = z.coerce.date();

export const BrdCreateSchema = z.object({
  projectId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200),
  contentMarkdown: z.string().min(1),
  changeSummary: z.string().trim().max(500).optional(),
});

export const BrdImportSchema = z.object({
  projectId: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
});

export const BrdVersionCreateSchema = z.object({
  contentMarkdown: z.string().min(1),
  changeSummary: z.string().trim().max(500).nullable().optional(),
  createdBy: z.enum(["AI_AGENT", "USER_MANUAL"]).default("AI_AGENT"),
});

export const BrdRestoreSchema = z.object({
  version: z.coerce.number().int().positive(),
});

export const BrdStatusSchema = z.object({
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED"]),
});
export type BrdStatusInput = z.infer<typeof BrdStatusSchema>;

export const BrdDiffQuerySchema = z.object({
  from: z.coerce.number().int().positive(),
  to: z.coerce.number().int().positive(),
});

// Provider/model/baseUrl/credentials can be overridden per user; empty or null
// values fall back to the server-managed defaults from env.
const optionalModelId = z.string().trim().max(200).nullable().optional();

export const SettingsPatchSchema = z.object({
  theme: z.string().trim().min(1).max(40).optional(),
  systemPrompt: z.string().max(20_000).nullable().optional(),
  aiProvider: z.enum(["openrouter", "custom"]).optional(),
  aiModel: optionalModelId,
  easyModel: optionalModelId,
  mediumModel: optionalModelId,
  hardModel: optionalModelId,
  customBaseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => value === "" || /^https?:\/\//i.test(value), {
      message: "Base URL harus diawali http:// atau https://",
    })
    .nullable()
    .optional(),
  apiKey: z.string().trim().max(500).nullable().optional(),
});

// Structure is validated and normalized server-side via the agent package
// (normalizeTemplateStructure) before it is persisted.
export const TemplateStructurePatchSchema = z.object({
  templateStructure: z.unknown(),
});
export type TemplateStructurePatchInput = z.infer<typeof TemplateStructurePatchSchema>;

export const TemplateManualCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  templateStructure: z.unknown(),
});
export type TemplateManualCreateInput = z.infer<typeof TemplateManualCreateSchema>;

export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200),
  type: z.enum(["brd", "document"]).optional(),
  projectId: z.string().trim().min(1).optional(),
  sessionId: z.string().trim().min(1).optional(),
  excludeSession: z.string().trim().min(1).optional(),
});

export const ErrorResponseSchema = z.object({ error: z.string() });
export const StreamProtocol = "application/x-ndjson" as const;
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
        projectId: z.string().nullable(),
        sessionId: z.string().nullable(),
      })
      .passthrough(),
  ),
});

export const ContractDateSchema = isoDate;

export type BrdCreateInput = z.infer<typeof BrdCreateSchema>;
export type BrdImportInput = z.infer<typeof BrdImportSchema>;
export type BrdVersionCreateInput = z.infer<typeof BrdVersionCreateSchema>;
export type SettingsPatchInput = z.infer<typeof SettingsPatchSchema>;

export const BrdClarifySchema = z.object({
  userStory: z.string().trim().min(1),
  round: z.coerce.number().int().min(1).max(2).default(1),
  answers: z.record(z.string(), z.string()).default({}),
});
export const BrdSubmitClarificationSchema = z.object({
  userStory: z.string().trim().min(1),
  answers: z.record(z.string(), z.string()),
  round: z.coerce.number().int().min(1).max(2).default(1),
  skip: z.boolean().default(false),
});
export const ClarificationResponseSchema = z.object({
  type: z.literal("clarification"),
  round: z.number().int().min(1).max(2),
  clarification_questions: z.array(z.unknown()).max(3),
  capped: z.boolean(),
});
export const BrdFlowResponseSchema = z.discriminatedUnion("type", [
  ClarificationResponseSchema,
  z.object({ type: z.literal("generating") }),
  z.object({
    type: z.literal("brd"),
    round: z.number().int().min(1).max(2),
    brd: z.object({ id: z.string(), title: z.string() }).passthrough(),
    markdown: z.string().min(1),
    assumptions: z.array(z.string()),
    context: z.string(),
  }),
]);
export type BrdClarifyInput = z.infer<typeof BrdClarifySchema>;
export type BrdSubmitClarificationInput = z.infer<typeof BrdSubmitClarificationSchema>;
