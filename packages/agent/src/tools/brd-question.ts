import { createTool } from "@anvia/core";
import { z } from "zod";

export const answerBrdQuestionTool = createTool({
  name: "answer_brd_question",
  description: "Answer a System Analyst question using only the selected BRD context.",
  inputSchema: z.object({
    question: z.string().min(1),
    brd: z.string().min(1),
  }),
  execute: async ({ question, brd }) => {
    const normalized = question
      .toLowerCase()
      .replace(/[?!.,]/g, "")
      .trim();
    const sentences = brd
      .split(/(?<=[.!?])\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const terms = normalized.split(/\s+/).filter((term) => term.length > 3);
    const evidence = sentences.find((sentence) =>
      terms.some((term) => sentence.toLowerCase().includes(term)),
    );
    if (!evidence)
      return {
        answer: null,
        citations: [],
        gaps: ["Pertanyaan tidak dapat dijawab dari BRD yang diberikan."],
      };
    const id = evidence.match(/\b(?:FR|BR)-\d+\b/)?.[0];
    return {
      answer: evidence,
      citations: [{ section: id ?? "BRD", quote: evidence }],
      gaps: [],
    };
  },
});

export function answerBrdQuestion(question: string, brd: string) {
  const normalized = question
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .trim();
  const sentences = brd
    .split(/(?<=[.!?])\s+|\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const terms = normalized.split(/\s+/).filter((term) => term.length > 3);
  const evidence = sentences.find((sentence) =>
    terms.some((term) => sentence.toLowerCase().includes(term)),
  );
  if (!evidence)
    return {
      answer: null,
      citations: [],
      gaps: ["Pertanyaan tidak dapat dijawab dari BRD yang diberikan."],
    };
  const id = evidence.match(/\b(?:FR|BR)-\d+\b/)?.[0];
  return { answer: evidence, citations: [{ section: id ?? "BRD", quote: evidence }], gaps: [] };
}
