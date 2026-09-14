import type { BrdTemplateStructure, JudgeOutput } from "@sa-ai-assistant/agent";

export const FALLBACK_FOLLOW_UPS: JudgeOutput["clarification_questions"] = [
  {
    id: "q2_1",
    question: "Apa alur utama yang harus dilakukan pengguna dari pengajuan sampai selesai?",
    purpose: "Melengkapi alur pengguna dan perubahan status.",
    options: [],
    required: true,
  },
  {
    id: "q2_2",
    question: "Apa validasi dan kondisi gagal yang harus ditangani sistem?",
    purpose: "Melengkapi validasi dan exception flow.",
    options: [],
    required: true,
  },
  {
    id: "q2_3",
    question: "Apa kriteria yang menentukan bahwa proses berhasil?",
    purpose: "Melengkapi acceptance criteria yang dapat diuji.",
    options: [],
    required: true,
  },
];

/** Ensure round-2 questions are fresh: drop answered ids, renumber to q2_{n}, cap at 3. */
export function followUpQuestions(
  questions: JudgeOutput["clarification_questions"],
  answers: Record<string, string>,
) {
  const answered = new Set(Object.keys(answers));
  const fresh = questions
    .filter((question) => !answered.has(question.id))
    .map((question, index) => ({ ...question, id: `q2_${index + 1}` }))
    .slice(0, 3);
  return fresh.length ? fresh : FALLBACK_FOLLOW_UPS;
}

export function missingRequiredSections(
  markdown: string,
  structure: BrdTemplateStructure | null,
): string[] {
  if (!structure) return [];
  const haystack = markdown.toLowerCase();
  return structure.sections
    .filter((section) => section.required)
    .filter((section) => {
      const title = section.title.toLowerCase();
      const id = section.id.toLowerCase();
      return !haystack.includes(title) && !haystack.includes(id);
    })
    .map((section) => section.title);
}

export type StageDecision = "stage" | "noop" | "conflict";

/**
 * A pending preview must be resolved (approved or rejected) before a new one is
 * staged, so an earlier modification is never silently overwritten.
 */
export function canStageModification(
  pendingContentMarkdown: string | null | undefined,
  nextContentMarkdown: string,
): StageDecision {
  if (!pendingContentMarkdown) return "stage";
  return pendingContentMarkdown === nextContentMarkdown ? "noop" : "conflict";
}

export type BrdStatus = "DRAFT" | "IN_REVIEW" | "APPROVED";

export const BRD_STATUS_TRANSITIONS: Record<BrdStatus, readonly BrdStatus[]> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["IN_REVIEW"],
};

export function canTransitionBrdStatus(from: BrdStatus, to: BrdStatus): boolean {
  return BRD_STATUS_TRANSITIONS[from].includes(to);
}

/** An approved BRD that changes must go back to review before it is trusted again. */
export function statusAfterModification(from: BrdStatus): BrdStatus {
  return from === "APPROVED" ? "IN_REVIEW" : from;
}
