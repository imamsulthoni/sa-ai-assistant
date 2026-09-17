import { describe, expect, it } from "vitest";
import {
  copiedFromTemplateSource,
  createBrdDraft,
  looksLikeTemplateContent,
  looksProjectSpecific,
  sanitizeTemplateExtraction,
  templateExemplarBlock,
  type TemplateExtraction,
} from "./brd-drafting.js";

const SOURCE = `## 1. Ringkasan dan Ruang Lingkup
Aplikasi ini menghubungkan rekening bank pihak ketiga melalui OAuth SNAP BI untuk 200k nasabah aktif.
## 2. Kebutuhan Fungsional
FR-001 Sistem harus menyelesaikan linking rekening kurang dari 45 detik dengan enkripsi AES-256.`;

const EXTRACTION: TemplateExtraction = {
  sections: [
    {
      id: "ringkasan_ruang_lingkup",
      title: "Ringkasan dan Ruang Lingkup",
      required: true,
      purpose:
        "Aplikasi ini menghubungkan rekening bank pihak ketiga melalui OAuth SNAP BI untuk 200k nasabah aktif.",
      expectedFormat: "bullet untuk daftar in-scope dan out-of-scope.",
      example: "- In-scope: [Kemampuan Utama].\n- Out-of-scope: [Kemampuan di Luar Cakupan].",
      order: 1,
    },
    {
      id: "kebutuhan_fungsional",
      title: "Kebutuhan Fungsional",
      required: true,
      purpose: "Menjelaskan perilaku sistem yang dapat diamati pengguna.",
      expectedFormat: "Daftar FR-001 dengan latensi < 45 detik dan enkripsi AES-256.",
      example: "FR-001 Sistem harus menyelesaikan linking rekening kurang dari 45 detik.",
      order: 2,
    },
  ],
  idConventions: ["BR-###", "FR-###"],
  language: "id",
  acceptanceStyle: "Given/When/Then",
  metadata: { templateName: "Template BRD", description: null, sourceFormat: "markdown" },
};

describe("copiedFromTemplateSource", () => {
  it("detects verbatim sentences from the source document", () => {
    const copied = "Aplikasi ini menghubungkan rekening bank pihak ketiga melalui OAuth SNAP BI";
    expect(copiedFromTemplateSource(copied, SOURCE)).toBe(true);
  });

  it("accepts generic structural descriptions", () => {
    expect(
      copiedFromTemplateSource("Menjelaskan cakupan dan batasan inisiatif pada fase ini.", SOURCE),
    ).toBe(false);
  });
});

describe("looksLikeTemplateContent", () => {
  it("flags values that mix requirement ids with measured targets", () => {
    expect(
      looksLikeTemplateContent("FR-001 selesai < 45 detik dengan enkripsi AES-256", SOURCE),
    ).toBe(true);
  });
});

describe("looksProjectSpecific", () => {
  it("flags project acronyms, Title Case names, and document references", () => {
    expect(
      looksProjectSpecific("Template BRD untuk pengembangan Learning Management System (LMS)"),
    ).toBe(true);
    expect(looksProjectSpecific("Dokumen ini menjelaskan kebutuhan sistem")).toBe(true);
    expect(looksProjectSpecific("Integrasi aplikasi Core Banking dengan sistem lama")).toBe(true);
  });

  it("accepts generic structural wording", () => {
    expect(looksProjectSpecific("Template BRD dengan 6 bab standar")).toBe(false);
    expect(looksProjectSpecific("Template BRD standar untuk semua inisiatif")).toBe(false);
    expect(looksProjectSpecific("Business Requirement Document perusahaan")).toBe(false);
    expect(looksProjectSpecific("Given/When/Then")).toBe(false);
  });
});

describe("sanitizeTemplateExtraction", () => {
  it("drops copied purpose and content-like format while keeping generic values", () => {
    const sanitized = sanitizeTemplateExtraction(EXTRACTION, SOURCE);

    expect(sanitized.sections[0].purpose).toBeNull();
    expect(sanitized.sections[0].expectedFormat).toBe(
      "bullet untuk daftar in-scope dan out-of-scope.",
    );
    expect(sanitized.sections[1].purpose).toBe(
      "Menjelaskan perilaku sistem yang dapat diamati pengguna.",
    );
    expect(sanitized.sections[1].expectedFormat).toBeNull();
    expect(sanitized.idConventions).toEqual(["BR-###", "FR-###"]);
  });

  it("keeps generalized examples but drops verbatim copies from the source", () => {
    const sanitized = sanitizeTemplateExtraction(EXTRACTION, SOURCE);

    expect(sanitized.sections[0].example).toContain("[Kemampuan Utama]");
    expect(sanitized.sections[1].example).toBeNull();
  });

  it("generalizes project-specific metadata instead of echoing the source subject", () => {
    const sanitized = sanitizeTemplateExtraction(
      {
        ...EXTRACTION,
        sections: [
          {
            ...EXTRACTION.sections[0],
            purpose: "Menjelaskan integrasi aplikasi LMS dengan sistem akademik.",
          },
          EXTRACTION.sections[1],
        ],
        metadata: {
          templateName: "BRD LMS",
          description:
            "Template BRD untuk pengembangan Learning Management System (LMS) di perusahaan.",
          sourceFormat: "docx",
        },
      },
      SOURCE,
    );

    expect(sanitized.metadata.templateName).toBe("Template BRD Standar");
    expect(sanitized.metadata.description).toContain("Template BRD dengan 2 bab standar");
    expect(sanitized.metadata.description).not.toMatch(/LMS|Learning Management/i);
    expect(sanitized.metadata.sourceFormat).toBe("docx");
    expect(sanitized.sections[0].purpose).toBeNull();
  });

  it("keeps generic metadata untouched", () => {
    const sanitized = sanitizeTemplateExtraction(
      {
        ...EXTRACTION,
        metadata: {
          templateName: "Template BRD Perusahaan",
          description: "Template BRD standar untuk semua inisiatif.",
          sourceFormat: "docx",
        },
      },
      SOURCE,
    );

    expect(sanitized.metadata.templateName).toBe("Template BRD Perusahaan");
    expect(sanitized.metadata.description).toBe("Template BRD standar untuk semua inisiatif.");
  });

  it("fills a generic description when the extractor returned none", () => {
    const sanitized = sanitizeTemplateExtraction(
      {
        ...EXTRACTION,
        metadata: { templateName: null, description: null, sourceFormat: null },
      },
      SOURCE,
    );

    expect(sanitized.metadata.templateName).toBe("Template BRD Standar");
    expect(sanitized.metadata.description).toBe(
      "Template BRD dengan 2 bab standar: Ringkasan dan Ruang Lingkup, Kebutuhan Fungsional.",
    );
  });
});

describe("createBrdDraft", () => {
  it("never injects purpose/format text as section body for unknown sections", () => {
    const draft = createBrdDraft(
      "Sebagai analis, saya ingin menyusun BRD.",
      [{ id: "q1", answer: "Jawaban" }],
      {
        sections: [
          {
            id: "lampiran_khusus",
            title: "Lampiran Khusus",
            required: true,
            purpose: "Informasi pelengkap yang tidak termasuk bagian utama.",
            expectedFormat: "bullet singkat.",
            order: 1,
          },
        ],
        idConventions: [],
        language: "id",
        acceptanceStyle: "Given/When/Then",
        metadata: { templateName: "Template", description: null, sourceFormat: "markdown" },
      },
    );

    expect(draft.markdown).toContain("- (see lampiran_khusus)");
    expect(draft.markdown).not.toContain("Informasi pelengkap yang tidak termasuk bagian utama.");
    expect(draft.markdown).not.toContain("bullet singkat.");
  });
});

describe("templateExemplarBlock", () => {
  it("renders a style block with generalized examples and an anti-copy guard", () => {
    const block = templateExemplarBlock({
      sections: [
        { id: "ringkasan", title: "Ringkasan", required: true, example: "- [Poin Utama].", order: 1 },
        { id: "fungsional", title: "Fungsional", required: true, example: null, order: 2 },
        {
          id: "penerimaan",
          title: "Penerimaan",
          required: true,
          example: "Given [kondisi] When [aksi] Then [hasil].",
          order: 3,
        },
      ],
      idConventions: [],
    });

    expect(block).toContain("Ringkasan: - [Poin Utama].");
    expect(block).toContain("Penerimaan: Given");
    expect(block).not.toContain("Fungsional");
    expect(block).toContain("JANGAN salin");
  });

  it("returns an empty string when no section has an example", () => {
    expect(
      templateExemplarBlock({
        sections: [{ id: "a", title: "A", required: true, order: 1 }],
        idConventions: [],
      }),
    ).toBe("");
  });

  it("respects the total character budget", () => {
    const block = templateExemplarBlock(
      {
        sections: [
          { id: "a", title: "A", required: true, example: "AAAA", order: 1 },
          { id: "b", title: "B", required: true, example: "BBBB", order: 2 },
        ],
        idConventions: [],
      },
      { maxChars: 12 },
    );

    expect(block).toContain("A: AAAA");
    expect(block).not.toContain("B: BBBB");
  });
});
