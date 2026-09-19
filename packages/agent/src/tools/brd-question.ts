import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";

type BrdAnswer = {
  answer: string | null;
  citations: Array<{ section: string; quote: string }>;
  gaps: string[];
};

/**
 * Cari baris BRD paling relevan untuk pertanyaan. Skor dihitung dari jumlah
 * term yang cocok (bukan sekadar term pertama), lalu heading terdekat dipakai
 * sebagai konteks section.
 */
export function answerBrdQuestion(question: string, brd: string): BrdAnswer {
  const terms = question
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .split(/\s+/)
    .filter((term) => term.length > 3);
  const lines = brd
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let heading: string | null = null;
  let best: string | null = null;
  let bestHeading: string | null = null;
  let bestScore = 0;
  for (const line of lines) {
    const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      continue;
    }
    const haystack = line.toLowerCase();
    const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = line;
      bestHeading = heading;
    }
  }

  if (!best || bestScore === 0) {
    return {
      answer: null,
      citations: [],
      gaps: ["Pertanyaan tidak dapat dijawab dari BRD yang diberikan."],
    };
  }
  const id = best.match(/\b(?:FR|BR)-\d+\b/)?.[0];
  return {
    answer: best,
    citations: [{ section: id ?? bestHeading ?? "BRD", quote: best }],
    gaps: [],
  };
}

/** Tool statis tanpa adapter: pemanggil wajib mengirim markdown BRD. */
export const answerBrdQuestionTool = createTool({
  name: "answer_brd_question",
  description: "Answer a System Analyst question using only the provided BRD context.",
  inputSchema: z.object({
    question: z.string().min(1),
    brd: z.string().min(1),
  }),
  execute: async ({ question, brd }) => answerBrdQuestion(question, brd),
});

/**
 * Tool dengan adapter konteks: `brd` sengaja tidak ada di schema supaya model
 * tidak pernah menyalin dokumen ke argumen tool.
 */
export function createAnswerBrdQuestionTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "answer_brd_question",
    description:
      "Answer a System Analyst question using only the active BRD. The document is resolved automatically server-side; never send BRD content in the arguments.",
    inputSchema: z.object({ question: z.string().min(1) }),
    execute: async ({ question }) => {
      const markdown = (await resolved.getActiveBrd({}))?.contentMarkdown ?? "";
      if (!markdown.trim()) {
        return {
          answer: null,
          citations: [],
          gaps: ["BRD aktif tidak ditemukan."],
        };
      }
      return answerBrdQuestion(question, markdown);
    },
  });
}
