import { createTool } from "@anvia/core";
import { z } from "zod";

export const modifyBrdTool = createTool({
  name: "modify_brd",
  description: "Apply a requested addition, change, or removal to an existing BRD.",
  inputSchema: z.object({
    brd: z.string().min(1),
    changeRequest: z.string().min(1),
    referenceContext: z.string().default(""),
  }),
  execute: async ({ brd, changeRequest, referenceContext }) => ({
    brd,
    changeRequest,
    referenceContext,
    status: "ready_for_model_completion" as const,
  }),
});
