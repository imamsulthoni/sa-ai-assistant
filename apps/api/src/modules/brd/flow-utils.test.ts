import { describe, expect, it } from "vitest";
import {
  canStageModification,
  canTransitionBrdStatus,
  followUpQuestions,
  missingRequiredSections,
  statusAfterModification,
  titleFromStory,
  weakRequiredSections,
} from "./flow-utils.js";
import type { BrdTemplateStructure, JudgeOutput } from "@sa-ai-assistant/agent";

const STRUCTURE: BrdTemplateStructure = {
  sections: [
    { id: "ringkasan", title: "Ringkasan dan ruang lingkup", required: true, order: 1 },
    { id: "fungsional", title: "Kebutuhan fungsional", required: true, order: 2 },
    { id: "lampiran", title: "Lampiran", required: false, order: 3 },
  ],
  idConventions: [],
};

const JUDGE_QUESTIONS: JudgeOutput["clarification_questions"] = [
  { id: "q1_1", question: "A?", purpose: "p", options: [], required: true },
  { id: "q1_2", question: "B?", purpose: "p", options: [], required: true },
  { id: "q1_3", question: "C?", purpose: "p", options: [], required: true },
  { id: "q1_4", question: "D?", purpose: "p", options: [], required: true },
];

describe("missingRequiredSections", () => {
  it("returns missing required sections only", () => {
    const markdown = "# BRD\n\n## Ringkasan dan ruang lingkup\nisi";
    expect(missingRequiredSections(markdown, STRUCTURE)).toEqual(["Kebutuhan fungsional"]);
  });

  it("returns an empty list when no template is active", () => {
    expect(missingRequiredSections("# BRD", null)).toEqual([]);
  });
});

describe("weakRequiredSections", () => {
  it("flags present required sections whose body is too thin", () => {
    const markdown =
      "# BRD\n\n## Ringkasan dan ruang lingkup\nterlalu singkat\n\n" +
      `## Kebutuhan fungsional\n${"detail perilaku sistem. ".repeat(30)}`;
    expect(weakRequiredSections(markdown, STRUCTURE, { minChars: 50 })).toEqual([
      "Ringkasan dan ruang lingkup",
    ]);
  });

  it("ignores sections that are missing entirely", () => {
    const markdown = `# BRD\n\n## Ringkasan dan ruang lingkup\n${"x".repeat(100)}`;
    expect(weakRequiredSections(markdown, STRUCTURE, { minChars: 50 })).toEqual([]);
  });

  it("returns an empty list without a template", () => {
    expect(weakRequiredSections("# BRD", null)).toEqual([]);
  });
});

describe("followUpQuestions", () => {
  it("drops answered questions, renumbers, and caps at three", () => {
    const result = followUpQuestions(JUDGE_QUESTIONS, { q1_1: "sudah dijawab" });
    expect(result).toHaveLength(3);
    expect(result.map((question) => question.id)).toEqual(["q2_1", "q2_2", "q2_3"]);
    expect(result[0].question).toBe("B?");
  });

  it("falls back to generic questions when everything was answered", () => {
    const answers = Object.fromEntries(JUDGE_QUESTIONS.map((question) => [question.id, "x"]));
    const result = followUpQuestions(JUDGE_QUESTIONS, answers);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("q2_1");
  });
});

describe("canStageModification", () => {
  it("stages when there is no pending preview", () => {
    expect(canStageModification(null, "baru")).toBe("stage");
  });

  it("is idempotent for the same pending content", () => {
    expect(canStageModification("sama", "sama")).toBe("noop");
  });

  it("reports a conflict instead of overwriting a different pending preview", () => {
    expect(canStageModification("lama", "baru")).toBe("conflict");
  });
});

describe("titleFromStory", () => {
  it("collapses whitespace and keeps short stories intact", () => {
    expect(titleFromStory("  Cuti   tahunan\nkaryawan ")).toBe("Cuti tahunan karyawan");
  });

  it("truncates long stories with an ellipsis", () => {
    const title = titleFromStory("x".repeat(120));
    expect(title).toHaveLength(60);
    expect(title.endsWith("…")).toBe(true);
  });

  it("falls back to a generic title for empty stories", () => {
    expect(titleFromStory("   ")).toBe("BRD baru");
  });
});

describe("BRD status transitions", () => {
  it("allows draft -> in review -> approved", () => {
    expect(canTransitionBrdStatus("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransitionBrdStatus("IN_REVIEW", "APPROVED")).toBe(true);
  });

  it("does not allow draft -> approved directly", () => {
    expect(canTransitionBrdStatus("DRAFT", "APPROVED")).toBe(false);
  });

  it("sends any BRD back to review after an approved modification", () => {
    expect(statusAfterModification()).toBe("IN_REVIEW");
  });
});
