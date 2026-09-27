import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";
import { parseBrdSections, type BrdSectionNode } from "./brd-outline.js";

type BrdAnswer = {
  answer: string | null;
  citations: Array<{ section: string; quote: string }>;
  gaps: string[];
};

/** Batas panjang kutipan section yang dikirim balik ke model. */
export const MAX_ANSWER_CHARS = 2400;

function questionTerms(question: string): string[] {
  return question
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .split(/\s+/)
    .filter((term) => term.length > 3);
}

function scoreBody(body: string, terms: readonly string[]): number {
  const haystack = body.toLowerCase();
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
}

function bestLineIn(body: string, terms: readonly string[]): { line: string; index: number } {
  let best = { line: "", index: -1, score: 0 };
  let offset = 0;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (line) {
      const score = scoreBody(line, terms);
      if (score > best.score) best = { line, index: offset, score };
    }
    offset += raw.length + 1;
  }
  return { line: best.line, index: best.index };
}

/** Ambil jendela teks di sekitar baris terbaik bila body melebihi batas. */
function excerpt(body: string, focusIndex: number, maxChars: number): string {
  if (body.length <= maxChars) return body;
  const half = Math.floor(maxChars / 2);
  const start = Math.max(0, Math.min(focusIndex - half, body.length - maxChars));
  const end = Math.min(body.length, start + maxChars);
  return `${start > 0 ? "…" : ""}${body.slice(start, end)}${end < body.length ? "…" : ""}`;
}

type SectionHit = {
  node: BrdSectionNode;
  body: string;
  score: number;
};

/**
 * Retrieval server-side: skor setiap section dari jumlah term yang cocok, pilih
 * section dengan skor tertinggi, lalu kembalikan kutipan body-nya (bukan seluruh
 * dokumen) supaya jawaban tetap murah dan presisi.
 */
export function answerBrdQuestion(question: string, brd: string): BrdAnswer {
  const terms = questionTerms(question);
  if (!terms.length) {
    return {
      answer: null,
      citations: [],
      gaps: ["Pertanyaan tidak dapat dijawab dari BRD yang diberikan."],
    };
  }

  const lines = brd.replace(/\r\n/g, "\n").split("\n");
  let hit: SectionHit | null = null;
  for (const node of parseBrdSections(brd)) {
    const body = lines.slice(node.start + 1, node.end).join("\n");
    const score = scoreBody(body, terms);
    if (score === 0) continue;
    const better =
      !hit ||
      score > hit.score ||
      (score === hit.score && body.length > 0 && body.length < hit.body.length);
    if (better) hit = { node, body, score };
  }

  if (!hit) {
    return {
      answer: null,
      citations: [],
      gaps: ["Pertanyaan tidak dapat dijawab dari BRD yang diberikan."],
    };
  }

  const { line, index } = bestLineIn(hit.body, terms);
  const heading = lines[hit.node.start]!.trim();
  const body = excerpt(hit.body.trim(), Math.max(index, 0), MAX_ANSWER_CHARS);
  return {
    answer: `${heading}\n${body}`.trim(),
    citations: [
      {
        section: hit.node.id ?? hit.node.title,
        quote: line || heading,
      },
    ],
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
      "Answer a System Analyst question using only the active BRD. Retrieval runs server-side and returns only the relevant section; never send BRD content in the arguments.",
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
