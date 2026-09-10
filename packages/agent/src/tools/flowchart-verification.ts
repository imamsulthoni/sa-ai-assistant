import { createTool } from "@anvia/core";
import { z } from "zod";

export const verifyFlowchartTool = createTool({
  name: "verify_flowchart",
  description: "Compare a flowchart description with BRD requirements and report matches and gaps.",
  inputSchema: z.object({
    flowchart: z.string().min(1),
    brd: z.string().min(1),
  }),
  execute: async ({ flowchart, brd }) => {
    const brdTerms = brd
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 4);
    const flowchartText = flowchart.toLowerCase();
    const matches = [...new Set(brdTerms.filter((term) => flowchartText.includes(term)))].slice(
      0,
      20,
    );
    const gaps = brdTerms.filter((term) => !flowchartText.includes(term)).slice(0, 20);
    return {
      matches: matches.map((term) => `Flowchart contains BRD term: ${term}`),
      gaps: gaps.map((term) => `BRD term not found in flowchart: ${term}`),
      recommendations: gaps.length
        ? ["Review each exposed gap with the System Analyst; do not silently repair the flowchart."]
        : [],
    };
  },
});
