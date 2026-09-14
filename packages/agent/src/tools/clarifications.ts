import { createTool } from "@anvia/core";
import { z } from "zod";

const ClarificationQuestionSchema = z.object({
  id: z.string().regex(/^q[0-9]+(?:_[0-9]+)?$/),
  question: z.string().min(1),
  purpose: z.string().min(1).default("Resolve an implementation-impacting ambiguity."),
  options: z.array(z.string()).max(5),
  required: z.boolean(),
});

export const ClarificationOutputSchema = z.object({
  clarification_questions: z.array(ClarificationQuestionSchema).max(3),
  round: z.number().int().min(1).max(2),
  capped: z.boolean(),
});

export type ClarificationOutput = z.infer<typeof ClarificationOutputSchema>;

export const elicitClarificationsTool = createTool({
  name: "elicit_clarifications",
  description:
    "Validate and return a bounded batch of clarification questions selected by the analyst agent.",
  inputSchema: z.object({
    userStory: z.string().trim().min(1),
    answersSoFar: z.array(z.object({ id: z.string(), answer: z.string() })).default([]),
    round: z.number().int().min(1).max(2),
    questions: z.array(ClarificationQuestionSchema).max(3),
  }),
  execute: async ({ answersSoFar, round, questions }) => ({
    clarification_questions: questions.filter(
      (question) =>
        !answersSoFar.some((answer) => answer.id === question.id && answer.answer.trim()),
    ),
    round,
    capped: round === 2,
  }),
});
