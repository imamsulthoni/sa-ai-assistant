import { createTool } from "@anvia/core";
import { z } from "zod";

const ClarificationInputSchema = z.object({
  userStory: z.string().trim().min(1),
  answersSoFar: z.array(z.object({ id: z.string(), answer: z.string() })).default([]),
  round: z.number().int().min(1).max(2),
});

export const ClarificationQuestionSchema = z.object({
  id: z.string().regex(/^q[0-9]+$/),
  question: z.string().min(1),
  options: z.array(z.string()).max(5),
  required: z.boolean(),
});

export function buildClarificationQuestions(userStory: string, round: number) {
  const lower = userStory.toLowerCase();
  const questions = [];
  if (!/(actor|user|customer|admin|staff)/i.test(userStory)) {
    questions.push({
      id: "q1",
      question: "Siapa aktor utama dan siapa yang berwenang menjalankan proses ini?",
      options: [],
      required: true,
    });
  }
  if (/(login|payment|transaksi|limit|attempt|percobaan)/i.test(lower)) {
    questions.push({
      id: "q2",
      question: "Apa aturan batas, validasi, atau penanganan kegagalan yang harus berlaku?",
      options: ["Belum ditentukan", "Gunakan aturan bisnis yang sudah ada", "Isi aturan lain"],
      required: true,
    });
  } else {
    questions.push({
      id: "q2",
      question: "Apa hasil sukses dan skenario gagal yang wajib dicakup?",
      options: ["Sukses saja", "Sukses dan validasi gagal", "Sukses, gagal, dan timeout"],
      required: true,
    });
  }
  if (round === 2) {
    questions.push({
      id: "q3",
      question: "Apakah ada integrasi, audit, atau kebutuhan otorisasi khusus?",
      options: ["Tidak ada", "Ada, jelaskan", "Belum ditentukan"],
      required: false,
    });
  }
  return questions.slice(0, 3);
}

export const elicitClarificationsTool = createTool({
  name: "elicit_clarifications",
  description: "Return a deterministic, bounded batch of BRD clarification questions.",
  inputSchema: ClarificationInputSchema,
  execute: async ({ userStory, answersSoFar, round }) => ({
    clarification_questions: buildClarificationQuestions(userStory, round).filter(
      (question) =>
        !answersSoFar.some((answer) => answer.id === question.id && answer.answer.trim()),
    ),
    round,
    capped: round === 2,
  }),
});
