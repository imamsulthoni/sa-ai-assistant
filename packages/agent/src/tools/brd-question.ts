import { createTool } from "@anvia/core";
import { z } from "zod";

export const answerBrdQuestionTool = createTool({
  name: "answer_brd_question",
  description: "Answer strictly from the selected BRD, with citations or an explicit not-specified result.",
  inputSchema: z.object({
    question: z.string().trim().min(1),
    brd: z.string().trim().min(1),
  }),
  execute: async ({ question, brd }) => ({
    question,
    brd,
    status: "ready_for_model_completion" as const,
    answer: null,
    grounding: {
      required: true,
      citationRule: "Cite the relevant BRD heading or stable ID; if absent, return not_specified.",
      fallback: "not_specified",
    },
  }),
});
