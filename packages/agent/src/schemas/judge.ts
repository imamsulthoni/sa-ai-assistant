import { z } from "zod";

export const JudgeClarificationQuestionSchema = z.object({
  id: z.string().regex(/^q[0-9]+_[0-9]+$/),
  question: z.string().min(1),
  purpose: z.string().min(1),
  options: z.array(z.string()).max(5),
  required: z.boolean(),
});

export const JudgeOutputSchema = z.object({
  sufficient: z.boolean(),
  missing: z.array(z.string()).max(10),
  clarification_questions: z.array(JudgeClarificationQuestionSchema).max(3),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;
