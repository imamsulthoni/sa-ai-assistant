import { describe, expect, it } from "vitest";
import {
  formValuesToStructure,
  slugifySectionId,
  structureToFormValues,
  type TemplateBuilderValues,
} from "./template-builder.js";

describe("slugifySectionId", () => {
  it("turns a title into a snake_case identifier", () => {
    expect(slugifySectionId("Ruang Lingkup & Batasan")).toBe("ruang_lingkup_batasan");
  });

  it("falls back to a safe id when the title has no usable characters", () => {
    expect(slugifySectionId("???")).toBe("section");
  });
});

describe("formValuesToStructure", () => {
  it("maps form fields to the template JSON schema with sequential order", () => {
    const values: TemplateBuilderValues = {
      templateName: "Template BRD Manual",
      description: "Deskripsi",
      language: "id",
      acceptanceStyle: "Given/When/Then",
      idConventions: "BR-###, FR-###",
      sections: [
        {
          id: "scope",
          title: "Ruang Lingkup",
          required: true,
          purpose: "Batas in/out scope.",
          expectedFormat: "bullet",
          example: "",
        },
        {
          id: "",
          title: "Aktor & Peran",
          required: false,
          purpose: "",
          expectedFormat: "",
          example: " [Aktor] melakukan [Aksi]. ",
        },
      ],
    };

    expect(formValuesToStructure(values)).toEqual({
      sections: [
        {
          id: "scope",
          title: "Ruang Lingkup",
          required: true,
          purpose: "Batas in/out scope.",
          expectedFormat: "bullet",
          example: null,
          order: 0,
        },
        {
          id: "aktor_peran",
          title: "Aktor & Peran",
          required: false,
          purpose: null,
          expectedFormat: null,
          example: "[Aktor] melakukan [Aksi].",
          order: 1,
        },
      ],
      idConventions: ["BR-###", "FR-###"],
      language: "id",
      acceptanceStyle: "Given/When/Then",
      metadata: {
        templateName: "Template BRD Manual",
        description: "Deskripsi",
        sourceFormat: "manual",
      },
    });
  });
});

describe("structureToFormValues", () => {
  it("prefills and orders sections from a stored structure", () => {
    const values = structureToFormValues({
      sections: [
        { id: "b", title: "Kedua", required: false, order: 2 },
        { id: "a", title: "Pertama", required: true, order: 1 },
      ],
      idConventions: ["BR-###"],
      language: "id",
      metadata: { templateName: "T", description: "D" },
    });

    expect(values.templateName).toBe("T");
    expect(values.idConventions).toBe("BR-###");
    expect(values.sections.map((section) => section.title)).toEqual(["Pertama", "Kedua"]);
    expect(values.sections[0].required).toBe(true);
  });

  it("defaults metadata for an empty structure", () => {
    const values = structureToFormValues(null);

    expect(values.templateName).toBe("Template BRD Manual");
    expect(values.language).toBe("id");
    expect(values.sections).toEqual([]);
  });
});