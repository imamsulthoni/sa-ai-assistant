import { createTool } from "@anvia/core";
import { z } from "zod";

export const answerBrdQuestionTool = createTool({
  name: "answer_brd_question",
  description: "Answer a System Analyst question using only the selected BRD context.",
  inputSchema: z.object({
    question: z.string().min(1),
    brd: z.string().min(1),
  }),
  execute: async ({ question, brd }) => ({
    question,
    brd,
    status: "ready_for_model_completion" as const,
    answer: null,
  }),
});
