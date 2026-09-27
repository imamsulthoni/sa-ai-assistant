import { describe, expect, it } from "vitest";
import { MAX_ANSWER_CHARS, answerBrdQuestion, createAnswerBrdQuestionTool } from "./brd-question.js";

const BRD = `# BRD

## 1. Ruang lingkup
Sistem membantu pengajuan cuti karyawan.

## 2. Kebutuhan fungsional
### FR-001
Sistem harus menerima pengajuan cuti maksimal 3 hari.

### FR-002
Sistem harus menampilkan status pengajuan beserta riwayat persetujuan.
`;

describe("answerBrdQuestion", () => {
  it("returns the line with the most matching terms", () => {
    const result = answerBrdQuestion("berapa lama maksimal pengajuan cuti?", BRD);
    expect(result.answer).toContain("maksimal 3 hari");
    expect(result.citations[0].section).toBe("FR-001");
  });

  it("falls back to the nearest heading when no id is present", () => {
    const result = answerBrdQuestion("bagaimana pengajuan cuti karyawan?", BRD);
    expect(result.answer).toContain("pengajuan cuti karyawan");
    expect(result.citations[0].section).toBe("1. Ruang lingkup");
  });

  it("reports a gap for unrelated questions", () => {
    const result = answerBrdQuestion("bagaimana integrasi blockchain?", BRD);
    expect(result.answer).toBeNull();
    expect(result.gaps).toHaveLength(1);
  });

  it("caps the returned excerpt for very large sections", () => {
    const huge = `# BRD\n\n## 1. Ruang lingkup\n${"detail pengajuan cuti karyawan. ".repeat(500)}\n`;
    const result = answerBrdQuestion("bagaimana pengajuan cuti?", huge);
    expect(result.answer).not.toBeNull();
    expect(result.answer!.length).toBeLessThanOrEqual(MAX_ANSWER_CHARS + 40);
  });

  it("prefers a focused sub-section when scores tie", () => {
    const markdown =
      "# BRD\n\n## 2. Modul\n### FR-001\nSistem harus memproses pembayaran dengan aman.\n";
    const result = answerBrdQuestion("bagaimana sistem memproses pembayaran?", markdown);
    expect(result.citations[0].section).toBe("FR-001");
  });
});

describe("createAnswerBrdQuestionTool", () => {
  it("resolves the active BRD when the question omits the document", async () => {
    const tool = createAnswerBrdQuestionTool({
      getActiveBrd: () => ({ contentMarkdown: BRD, versions: [] }),
    });

    const output = await tool.call({ question: "riwayat persetujuan?" });

    expect(output.answer).toContain("riwayat persetujuan");
  });

  it("reports a gap when no active BRD exists", async () => {
    const tool = createAnswerBrdQuestionTool({ getActiveBrd: () => null });

    const output = await tool.call({ question: "apa saja kebutuhan?" });

    expect(output.answer).toBeNull();
    expect(output.gaps[0]).toContain("BRD aktif");
  });
});