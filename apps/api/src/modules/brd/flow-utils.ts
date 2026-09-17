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

export const FALLBACK_ROUND_1: JudgeOutput["clarification_questions"] = [
  {
    id: "q1_1",
    question: "Siapa aktor atau pengguna utama yang terlibat dalam proses ini?",
    purpose: "Melengkapi identifikasi aktor dan permission model.",
    options: [],
    required: true,
  },
  {
    id: "q1_2",
    question: "Apa alur utama yang diharapkan dari awal hingga akhir proses?",
    purpose: "Melengkapi alur utama dan batasan ruang lingkup.",
    options: [],
    required: true,
  },
  {
    id: "q1_3",
    question: "Apa data atau dokumen pendukung yang menjadi dasar proses ini?",
    purpose: "Melengkapi data utama dan integrasi.",
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

/** Ambang minimum isi sebuah section wajib (karakter, di luar heading). */
export const MIN_REQUIRED_SECTION_CHARS = 200;

/**
 * Isi markdown sebuah section berdasarkan heading yang memuat judul atau id-nya.
 * `null` bila section tidak ditemukan (kasus "hilang" ditangani terpisah).
 */
function sectionBody(markdown: string, title: string, id: string): string | null {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const needles = [title.trim().toLowerCase(), id.trim().toLowerCase()].filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^#{1,6}\s+(.*)$/.exec(lines[index]);
    if (!heading) continue;
    const text = heading[1].toLowerCase();
    if (!needles.some((needle) => text.includes(needle))) continue;
    let end = index + 1;
    while (end < lines.length && !/^#{1,6}\s+/.test(lines[end])) end += 1;
    return lines.slice(index + 1, end).join("\n");
  }
  return null;
}

/**
 * Section wajib yang ada tapi isinya terlalu tipis (di bawah ambang karakter).
 * Section yang sama sekali tidak ada tidak dikembalikan di sini.
 */
export function weakRequiredSections(
  markdown: string,
  structure: BrdTemplateStructure | null,
  options: { minChars?: number } = {},
): string[] {
  if (!structure) return [];
  const minChars = options.minChars ?? MIN_REQUIRED_SECTION_CHARS;
  return structure.sections
    .filter((section) => section.required)
    .filter((section) => {
      const body = sectionBody(markdown, section.title, section.id);
      if (body === null) return false;
      return body.replace(/\s+/g, " ").trim().length < minChars;
    })
    .map((section) => section.title);
}

/** Derive a readable BRD title from the user story instead of a generic label. */
export function titleFromStory(story: string): string {
  const line = story.replace(/\s+/g, " ").trim();
  if (!line) return "BRD baru";
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
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

/**
 * A BRD whose staged modification was approved always returns to review: the
 * content changed, so a previous approval no longer applies.
 */
export function statusAfterModification(): BrdStatus {
  return "IN_REVIEW";
}
