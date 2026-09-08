import { createTool } from "@anvia/core";
import { z } from "zod";

export const modifyBrdTool = createTool({
  name: "modify_brd",
  description: "Produce a reviewable BRD delta while preserving unaffected content and stable IDs.",
  inputSchema: z.object({
    brd: z.string().trim().min(1),
    changeRequest: z.string().trim().min(1),
    referenceContext: z.string().default(""),
    targetIds: z.array(z.string().regex(/^(BR|FR|NFR|AC)-\d{3}$/)).default([]),
  }),
  execute: async ({ brd, changeRequest, referenceContext, targetIds }) => ({
    brd,
    changeRequest,
    referenceContext,
    targetIds,
    status: "ready_for_model_completion" as const,
    invariants: ["Preserve unaffected sections", "Preserve existing requirement IDs", "List conflicts and unsupported assumptions"],
  }),
});
