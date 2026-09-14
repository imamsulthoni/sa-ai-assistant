import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { renderBrdPdf } from "./pdf.js";

const MARKDOWN = `# BRD

## 1. Ringkasan dan ruang lingkup
Sistem membantu pengajuan cuti — termasuk cuti tahunan.

- Poin pertama
- Poin kedua

| Aktor | Peran |
| --- | --- |
| Staf | Mengajukan |
| Supervisor | Menyetujui |

## 2. Alur
\`\`\`mermaid
flowchart TD
  A[Mulai] --> B[Selesai]
\`\`\`

## 3. Kebutuhan fungsional
### FR-001
Sistem harus menerima pengajuan cuti.
`;

describe("renderBrdPdf", () => {
  it("produces a PDF that pdf-lib can read back", async () => {
    const bytes = await renderBrdPdf({
      title: "BRD Cuti",
      version: 2,
      status: "IN_REVIEW",
      updatedAt: new Date("2026-09-14T00:00:00Z"),
      contentMarkdown: MARKDOWN,
    });
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(doc.getTitle()).toBe("BRD Cuti");
  });

  it("renders non-ASCII punctuation without throwing", async () => {
    const bytes = await renderBrdPdf({
      title: 'BRD "Cerdas"',
      version: 1,
      status: "DRAFT",
      updatedAt: new Date(),
      contentMarkdown: "# BRD\n\nRuang lingkup — 100% …\n",
    });
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });

  it("paginates long documents", async () => {
    const long = `# BRD\n\n## 1. Isi\n${Array.from({ length: 260 }, (_, index) => `Baris ${index + 1}.`).join("\n\n")}\n`;
    const bytes = await renderBrdPdf({
      title: "BRD Panjang",
      version: 1,
      status: "APPROVED",
      updatedAt: new Date(),
      contentMarkdown: long,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
