import { describe, expect, it } from "vitest";
import { parseTemplateStructure } from "./template-structure.js";

describe("parseTemplateStructure", () => {
  it("normalizes a valid structure and sorts sections by order", () => {
    const parsed = parseTemplateStructure({
      sections: [
        {
          id: "kebutuhan_fungsional",
          title: "Kebutuhan Fungsional",
          required: true,
          purpose: "Perilaku sistem yang dapat diamati.",
          expectedFormat: "Daftar FR-###.",
          order: 2,
        },
        {
          id: "ringkasan",
          title: "Ringkasan",
          required: false,
          purpose: null,
          expectedFormat: null,
          order: 1,
        },
      ],
      idConventions: ["BR-###", "FR-###", ""],
      language: "id",
      acceptanceStyle: "Given/When/Then",
      metadata: { templateName: "Template BRD", description: "  ", sourceFormat: "docx" },
    });

    expect(parsed?.sections.map((section) => section.title)).toEqual([
      "Ringkasan",
      "Kebutuhan Fungsional",
    ]);
    expect(parsed?.sections[0].required).toBe(false);
    expect(parsed?.idConventions).toEqual(["BR-###", "FR-###"]);
    expect(parsed?.templateName).toBe("Template BRD");
    expect(parsed?.description).toBeNull();
    expect(parsed?.sourceFormat).toBe("docx");
  });

  it("returns null when there is nothing displayable", () => {
    expect(parseTemplateStructure(null)).toBeNull();
    expect(parseTemplateStructure({})).toBeNull();
    expect(parseTemplateStructure({ sections: [] })).toBeNull();
    expect(parseTemplateStructure({ sections: [{ purpose: "tanpa judul" }] })).toBeNull();
  });

  it("falls back to positional order and generated ids for partial sections", () => {
    const parsed = parseTemplateStructure({ sections: [{ title: "Bab Tanpa Id" }] });

    expect(parsed?.sections[0]).toMatchObject({
      id: "section_1",
      title: "Bab Tanpa Id",
      order: 1,
      required: false,
      purpose: null,
      expectedFormat: null,
    });
  });
});
