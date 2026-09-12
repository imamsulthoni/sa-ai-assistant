import { createTool } from "@anvia/core";
import { z } from "zod";

const clarificationSchema = z.object({
  id: z.string().min(1),
  answer: z.string().min(1),
});

const BrdTemplateSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  required: z.boolean(),
  purpose: z.string().min(1).max(500).nullable().optional(),
  expectedFormat: z.string().min(1).max(500).nullable().optional(),
  order: z.number().int().nonnegative().nullable().optional(),
});

const BrdTemplateStructureSchema = z.object({
  sections: z.array(BrdTemplateSectionSchema).min(1).max(30),
  idConventions: z.array(z.string().min(1).max(200)).max(20).default([]),
  language: z.string().min(1).max(60).nullable().optional(),
  acceptanceStyle: z.string().min(1).max(200).nullable().optional(),
  metadata: z
    .object({
      templateName: z.string().nullable(),
      description: z.string().nullable(),
      sourceFormat: z.string().nullable(),
    })
    .partial()
    .optional(),
});

export type BrdTemplateSection = z.infer<typeof BrdTemplateSectionSchema>;
export type BrdTemplateStructure = z.infer<typeof BrdTemplateStructureSchema>;
export const TemplateStructureSchema = BrdTemplateStructureSchema;
// OpenAI Structured Outputs requires every object property to be required.
// Nullable fields preserve the distinction between "not found" and invalid data.
export const TemplateExtractionSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      required: z.boolean(),
      purpose: z.string().min(1).max(500).nullable(),
      expectedFormat: z.string().min(1).max(500).nullable(),
      order: z.number().int().nonnegative().nullable(),
    }),
  ).min(1).max(30),
  idConventions: z.array(z.string().min(1).max(200)).max(20),
  language: z.string().min(1).max(60).nullable(),
  acceptanceStyle: z.string().min(1).max(200).nullable(),
  metadata: z.object({
    templateName: z.string().nullable(),
    description: z.string().nullable(),
    sourceFormat: z.string().nullable(),
  }),
});

const KNOWN_SECTION_HINTS: Array<{ match: RegExp; body: string }> = [
  {
    match: /document.?control|kontrol.?dokumen/i,
    body: "- Status: Draft\n- Template: {{templateName}}\n- Date: (fill from generation date)",
  },
  {
    match: /summar|scope|ringkas|ruang.?lingkup/i,
    body: "{{userStory}}",
  },
  {
    match: /clarif|klarifikasi/i,
    body: "{{clarifications}}",
  },
  {
    match: /business.?requirement|business.?rule|kebutuhan.?bisnis|aturan.?bisnis/i,
    body: "### BR-001\nThe system shall implement the requested business outcome described in the user story.",
  },
  {
    match: /functional|fungsional/i,
    body: "### FR-001\nThe system shall accept and process the requested user action and expose a clear success or failure outcome.",
  },
  {
    match: /acceptance|kriteria.?terima/i,
    body: "- Given the stated user story, when the authorized actor performs the requested action, then the system produces the expected business outcome.",
  },
  {
    match: /assumption|asumsi|open.?question|review/i,
    body: "{{assumptions}}",
  },
  {
    match: /reference|referensi|traceab/i,
    body: "{{referenceContext}}",
  },
];

function orderedSections(template: BrdTemplateStructure): BrdTemplateSection[] {
  return [...template.sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function sectionBody(
  section: BrdTemplateSection,
  fallback: {
    userStory: string;
    clarificationText: string;
    assumptionsText: string;
    referenceText: string;
  },
  template: BrdTemplateStructure,
): string {
  const hint = KNOWN_SECTION_HINTS.find((candidate) =>
    candidate.match.test(`${section.id} ${section.title} ${section.purpose ?? ""}`),
  );
  const body = hint?.body ?? section.expectedFormat ?? section.purpose ?? "";
  return body
    .replaceAll("{{templateName}}", template.metadata?.templateName ?? "approved custom template")
    .replaceAll("{{userStory}}", fallback.userStory)
    .replaceAll("{{clarifications}}", fallback.clarificationText)
    .replaceAll("{{assumptions}}", fallback.assumptionsText)
    .replaceAll("{{referenceContext}}", fallback.referenceText);
}

export function normalizeTemplateStructure(value: unknown): BrdTemplateStructure | null {
  const parsed = BrdTemplateStructureSchema.safeParse(value);
  if (!parsed.success) return null;
  return { ...parsed.data, sections: orderedSections(parsed.data) };
}

export function renderTemplateScaffold(
  template: BrdTemplateStructure,
  parts: {
    userStory: string;
    clarificationText: string;
    assumptionsText: string;
    referenceText: string;
  },
): string {
  const sections = orderedSections(template);
  return `${sections
    .map(
      (section, index) =>
        `## ${index + 1}. ${section.title}\n${sectionBody(section, parts, template) || `- (see ${section.id})`}`,
    )
    .join("\n\n")}\n`;
}

export function validateBrdAgainstTemplate(
  markdown: string,
  template: BrdTemplateStructure,
): { missingRequired: string[]; missingIdConventions: string[] } {
  const missingRequired = orderedSections(template)
    .filter((section) => section.required)
    .filter((section) => {
      if (markdown.includes(`- (see ${section.id})`)) return true;
      const candidates = [section.title, section.id].filter(Boolean);
      return !candidates.some((candidate) =>
        markdown.toLowerCase().includes(candidate.toLowerCase()),
      );
    })
    .map((section) => section.id);
  const missingIdConventions = template.idConventions.filter((convention) => {
    try {
      return !new RegExp(convention).test(markdown);
    } catch {
      return !markdown.includes(convention);
    }
  });
  return { missingRequired, missingIdConventions };
}

export function templateInstructionBlock(template: BrdTemplateStructure): string {
  const lines = orderedSections(template).map(
    (section, index) =>
      `${index + 1}. ${section.title} [${section.id}]${section.required ? " (required)" : " (optional)"}${section.purpose ? ` - ${section.purpose}` : ""}${section.expectedFormat ? ` Format: ${section.expectedFormat}` : ""}`,
  );
  const conventions = template.idConventions.length
    ? `ID conventions: ${template.idConventions.join("; ")}`
    : "ID conventions: keep stable BR-### / FR-### identifiers.";
  const language = template.language ? `Language: ${template.language}.` : "";
  const acceptance = template.acceptanceStyle
    ? `Acceptance style: ${template.acceptanceStyle}.`
    : "";
  return [
    "Active BRD template (approved by the System Analyst - output MUST follow it):",
    ...lines,
    conventions,
    [language, acceptance].filter(Boolean).join(" "),
    "Rules: keep section order and titles; required sections MUST appear; a required section without source support MUST report a gap instead of inventing content.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function createBrdDraft(
  userStory: string,
  clarifications: readonly z.infer<typeof clarificationSchema>[],
  template: unknown,
  referenceContext = "",
) {
  const clarificationText = clarifications.length
    ? clarifications.map((item) => `- ${item.id}: ${item.answer}`).join("\n")
    : "- Tidak ada jawaban klarifikasi; detail yang belum tersedia ditandai sebagai asumsi.";
  const assumptions = clarifications.length
    ? []
    : ["Detail aktor, aturan validasi, dan skenario gagal perlu dikonfirmasi oleh System Analyst."];
  const normalized = normalizeTemplateStructure(template);
  const parts = {
    clarificationText,
    assumptionsText: assumptions.length
      ? assumptions.map((item) => `- ASSUMPTION: ${item}`).join("\n")
      : "- None identified from supplied context.",
    referenceText: referenceContext.trim() || "- No reference context supplied.",
  };
  const markdown = normalized
    ? `# BRD\n\n${renderTemplateScaffold(normalized, {
        userStory,
        clarificationText: `\n${userStory}\n\n${parts.clarificationText}`,
        assumptionsText: parts.assumptionsText,
        referenceText: parts.referenceText,
      })}`
    : `# BRD\n\n## 1. Document control\n- Status: Draft\n- Template: built-in default\n\n## 2. Summary and scope\n${userStory}\n\n## 3. Clarifications\n${parts.clarificationText}\n\n## 4. Business requirements and rules\n### BR-001\nThe system shall implement the requested business outcome described in the user story.\n\n## 5. Functional requirements\n### FR-001\nThe system shall accept and process the requested user action and expose a clear success or failure outcome.\n\n## 6. Acceptance criteria\n- Given the stated user story, when the authorized actor performs the requested action, then the system produces the expected business outcome.\n\n## 7. Reference context\n${parts.referenceText}\n\n## 8. Assumptions and open questions\n${parts.assumptionsText}\n`;
  return { markdown, assumptions, templateSource: normalized ? "custom" : "builtin" as const };
}

export const draftBrdTool = createTool({
  name: "draft_brd",
  description: "Create a grounded BRD draft after clarification sufficiency has been reached.",
  inputSchema: z.object({
    userStory: z.string().min(1),
    clarifications: z.array(clarificationSchema).default([]),
    templateStructure: z.unknown().optional(),
    referenceContext: z.string().default(""),
  }),
  execute: async ({ userStory, clarifications, templateStructure, referenceContext }) => {
    const sufficient = clarifications.length > 0 || referenceContext.trim().length > 0;
    if (!sufficient) {
      return {
        ready: false as const,
        markdown: null,
        assumptions: [],
        traceability: [],
        gaps: [
          "Clarification gate belum terpenuhi; berikan jawaban klarifikasi atau gunakan forced generation pada round cap.",
        ],
      };
    }
    const draft = createBrdDraft(userStory, clarifications, templateStructure, referenceContext);
    const normalized = normalizeTemplateStructure(templateStructure);
    const validation = normalized ? validateBrdAgainstTemplate(draft.markdown, normalized) : null;
    const gaps = [
      ...(validation?.missingRequired.map((id) => `Template section missing: ${id}`) ?? []),
      ...(validation?.missingIdConventions.map(
        (convention) => `ID convention not satisfied: ${convention}`,
      ) ?? []),
    ];
    return {
      ready: true as const,
      ...draft,
      gaps,
      traceability: [
        { source: "userStory" as const, target: "BR-001" },
        ...clarifications.map((item) => ({
          source: "clarification" as const,
          id: item.id,
          target: "FR-001",
        })),
        ...(referenceContext.trim() ? [{ source: "document" as const, target: "BR-001" }] : []),
      ],
    };
  },
});

