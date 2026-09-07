import { createTool } from "@anvia/core";
import { z } from "zod";

export const verifyFlowchartTool = createTool({
  name: "verify_flowchart",
  description: "Compare a flowchart description with BRD requirements and report matches and gaps.",
  inputSchema: z.object({
    flowchart: z.string().min(1),
    brd: z.string().min(1),
  }),
  execute: async ({ flowchart, brd }) => ({
    status: "requires_review" as const,
    flowchart,
    brd,
    matches: [],
    gaps: [],
    note: "The model should identify matches and gaps using the selected BRD context.",
  }),
});
