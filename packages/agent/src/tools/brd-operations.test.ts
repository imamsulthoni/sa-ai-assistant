import { describe, expect, it } from "vitest";
import { applyOperations, BrdOperationSchema, extractBrdDocument } from "./brd-operations.js";

const BRD = `# BRD

## 1. Ringkasan dan ruang lingkup
Sistem membantu pengajuan cuti karyawan.

## 2. Kebutuhan fungsional
### FR-001
Sistem harus menerima pengajuan cuti.

### FR-002
Sistem harus menampilkan status pengajuan.

## 3. Kriteria penerimaan
Diberikan pengajuan valid, ketika disetujui, maka status berubah.
`;

describe("applyOperations", () => {
  it("updates an existing requirement body in place", () => {
    const result = applyOperations(BRD, [
      {
        op: "update",
        requirementId: "FR-001",
        content: "Sistem harus menerima cuti maksimal 3 hari.",
      },
    ]);
    expect(result.applied).toBe(1);
    expect(result.updatedMarkdown).toContain("maksimal 3 hari");
    expect(result.updatedMarkdown).not.toContain("Sistem harus menerima pengajuan cuti.");
    expect(result.updatedMarkdown.match(/### FR-001/g)).toHaveLength(1);
    expect(result.updatedMarkdown).toContain("### FR-002");
  });

  it("reports a gap when the requirement id does not exist", () => {
    const result = applyOperations(BRD, [{ op: "update", requirementId: "FR-099", content: "x" }]);
    expect(result.applied).toBe(0);
    expect(result.ok).toBe(false);
    expect(result.gaps).toEqual(["FR-099 tidak ditemukan pada BRD."]);
  });

  it("removes a requirement block including its body", () => {
    const result = applyOperations(BRD, [{ op: "remove", requirementId: "FR-002" }]);
    expect(result.updatedMarkdown).not.toContain("FR-002");
    expect(result.updatedMarkdown).not.toContain("menampilkan status pengajuan");
    expect(result.updatedMarkdown).toContain("### FR-001");
    expect(result.updatedMarkdown).toContain("## 3. Kriteria penerimaan");
  });

  it("adds a new requirement with the next id inside the functional section", () => {
    const result = applyOperations(BRD, [
      { op: "add", title: "Notifikasi", content: "Sistem harus mengirim notifikasi persetujuan." },
    ]);
    expect(result.affectedIds).toEqual(["FR-003"]);
    const added = result.updatedMarkdown.indexOf("### FR-003");
    const nextSection = result.updatedMarkdown.indexOf("## 3. Kriteria penerimaan");
    expect(added).toBeGreaterThan(-1);
    expect(added).toBeLessThan(nextSection);
    expect(result.updatedMarkdown).toContain("**Notifikasi**");
  });

  it("refuses to add a requirement that already exists", () => {
    const result = applyOperations(BRD, [
      { op: "add", requirementId: "FR-001", content: "duplikat" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.gaps[0]).toContain("sudah ada");
  });

  it("replaces a non-requirement section body", () => {
    const result = applyOperations(BRD, [
      { op: "update_section", sectionTitle: "Ruang lingkup", content: "Fokus pada cuti tahunan." },
    ]);
    expect(result.applied).toBe(1);
    expect(result.updatedMarkdown).toContain("Fokus pada cuti tahunan.");
    expect(result.updatedMarkdown).not.toContain("Sistem membantu pengajuan cuti karyawan.");
    expect(result.updatedMarkdown).toContain("## 2. Kebutuhan fungsional");
  });

  it("updates a sub-section body without touching sibling sub-sections", () => {
    const withSubsections = `# BRD

## 1. Detail Proses
### 1.1 Checkout
Alur checkout lama.

### 1.2 Pembayaran
Alur pembayaran lama.

## 2. Lain
Tetap.
`;
    const result = applyOperations(withSubsections, [
      { op: "update_section", sectionTitle: "Pembayaran", content: "Alur pembayaran baru dengan retry." },
    ]);
    expect(result.applied).toBe(1);
    expect(result.updatedMarkdown).toContain("### 1.1 Checkout");
    expect(result.updatedMarkdown).toContain("Alur checkout lama.");
    expect(result.updatedMarkdown).toContain("Alur pembayaran baru dengan retry.");
    expect(result.updatedMarkdown).not.toContain("Alur pembayaran lama.");
  });

  it("patches an exact text snippet with replace_text", () => {
    const result = applyOperations(BRD, [
      {
        op: "replace_text",
        find: "Sistem harus menampilkan status pengajuan.",
        content: "Sistem harus menampilkan status pengajuan beserta riwayat persetujuan.",
      },
    ]);
    expect(result.applied).toBe(1);
    expect(result.updatedMarkdown).toContain("beserta riwayat persetujuan");
    expect(result.updatedMarkdown).not.toContain("Sistem harus menampilkan status pengajuan.\n");
    expect(result.changeSummary).toContain("potongan teks");
  });

  it("reports a gap when replace_text does not find the snippet", () => {
    const result = applyOperations(BRD, [
      { op: "replace_text", find: "teks yang tidak ada", content: "x" },
    ]);
    expect(result.applied).toBe(0);
    expect(result.gaps[0]).toContain("tidak ditemukan");
  });

  it("asks for more context when replace_text matches more than once", () => {
    const duplicated = "# BRD\n\n## 1. A\nSLA 99%.\n\n## 2. B\nSLA 99%.\n";
    const result = applyOperations(duplicated, [
      { op: "replace_text", find: "SLA 99%.", content: "SLA 99.9%." },
    ]);
    expect(result.applied).toBe(0);
    expect(result.gaps[0]).toContain("lebih dari sekali");
  });

  it("never collapses blank lines inside fenced code blocks", () => {
    const withFence = `# BRD

## 1. Alur
\`\`\`mermaid
flowchart TD

  A --> B


  B --> C
\`\`\`

## 2. Kebutuhan fungsional
### FR-001
x
`;
    const result = applyOperations(withFence, [
      { op: "update", requirementId: "FR-001", content: "y" },
    ]);
    expect(result.updatedMarkdown).toContain("A --> B\n\n\n  B --> C");
  });

  it("collapses excessive blank lines outside fences", () => {
    const messy = "# BRD\n\n\n\n## 1. A\n\n\n### FR-001\n\n\nx\n\n\n## 2. B\n";
    const result = applyOperations(messy, [
      { op: "update", requirementId: "FR-001", content: "y" },
    ]);
    expect(result.updatedMarkdown).not.toMatch(/\n{3,}/);
  });
});

describe("BrdOperationSchema", () => {
  it("rejects malformed requirement ids", () => {
    const parsed = BrdOperationSchema.safeParse({
      op: "update",
      requirementId: "F-1",
      content: "x",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("extractBrdDocument", () => {
  it("drops conversational preamble before the BRD title", () => {
    expect(extractBrdDocument("Draft valid. Saya menulis BRD final.\n\n# BRD\n\n## 1. A")).toBe(
      "# BRD\n\n## 1. A",
    );
  });

  it("keeps documents that already open with the title", () => {
    expect(extractBrdDocument("# BRD\n\nisi")).toBe("# BRD\n\nisi");
  });

  it("normalises CRLF and trims surrounding whitespace", () => {
    expect(extractBrdDocument("  # BRD\r\n\r\nisi  ")).toBe("# BRD\n\nisi");
  });

  it("returns trimmed text when no BRD title exists", () => {
    expect(extractBrdDocument("  tanpa judul  ")).toBe("tanpa judul");
  });
});
