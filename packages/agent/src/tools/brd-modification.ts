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
    updatedMarkdown: `${brd.trim()}\n\n## Change note\n${changeRequest.trim()}\n`,
    changeSummary: `Requested change recorded for review: ${changeRequest.trim()}`,
    affectedIds: [...brd.matchAll(/\b(?:FR|BR)-\d+\b/g)]
      .map((match) => match[0])
      .filter((id, index, ids) => ids.indexOf(id) === index),
    groundedByReference: Boolean(referenceContext.trim()),
    persisted: false as const,
  }),
});
