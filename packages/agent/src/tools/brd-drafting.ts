import { createTool } from "@anvia/core";
import { z } from "zod";

const clarificationSchema = z.object({
  id: z.string().min(1),
  answer: z.string().min(1),
});

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
  return {
    markdown: `# BRD\n\n## 1. Document control\n- Status: Draft\n- Template: ${template ? "approved custom template" : "built-in default"}\n\n## 2. Summary and scope\n${userStory}\n\n## 3. Clarifications\n${clarificationText}\n\n## 4. Business requirements and rules\n### BR-001\nThe system shall implement the requested business outcome described in the user story.\n\n## 5. Functional requirements\n### FR-001\nThe system shall accept and process the requested user action and expose a clear success or failure outcome.\n\n## 6. Acceptance criteria\n- Given the stated user story, when the authorized actor performs the requested action, then the system produces the expected business outcome.\n\n## 7. Reference context\n${referenceContext.trim() || "- No reference context supplied."}\n\n## 8. Assumptions and open questions\n${assumptions.length ? assumptions.map((item) => `- ASSUMPTION: ${item}`).join("\n") : "- None identified from supplied context."}\n`,
    assumptions,
  };
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
    return {
      ready: true as const,
      ...draft,
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
