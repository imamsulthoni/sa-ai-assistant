import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateStructureView } from "./template-structure-view.js";

describe("TemplateStructureView", () => {
  it("renders readable section details instead of raw JSON", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateStructureView, {
        structure: {
          sections: [
            {
              id: "ringkasan",
              title: "Ringkasan dan Ruang Lingkup",
              required: true,
              purpose: "Masalah bisnis, tujuan, dan kriteria keberhasilan.",
              expectedFormat: "bullet in-scope dan out-of-scope.",
              order: 1,
            },
            {
              id: "lampiran",
              title: "Lampiran",
              required: false,
              purpose: null,
              expectedFormat: null,
              order: 2,
            },
          ],
          idConventions: ["BR-###", "FR-###"],
          language: "id",
          acceptanceStyle: "Given/When/Then",
          metadata: {
            templateName: "Template BRD Perusahaan",
            description: null,
            sourceFormat: "docx",
          },
        },
      }),
    );

    expect(html).toContain("Template BRD Perusahaan");
    expect(html).toContain("Ringkasan dan Ruang Lingkup");
    expect(html).toContain("2 bab standar");
    expect(html).toContain("Wajib");
    expect(html).toContain("Opsional");
    expect(html).toContain("Format: bullet in-scope dan out-of-scope.");
    expect(html).toContain("ID: BR-### · FR-###");
    expect(html).not.toContain("&quot;sections&quot;");
  });

  it("explains when the structure cannot be displayed", () => {
    const html = renderToStaticMarkup(
      createElement(TemplateStructureView, { structure: { sections: [] } }),
    );
    expect(html).toContain("Struktur template belum dapat ditampilkan");
  });
});
