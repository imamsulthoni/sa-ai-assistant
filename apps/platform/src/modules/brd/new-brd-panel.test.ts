import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewBrdPanel } from "./new-brd-panel.js";
import type { TemplateSummary } from "#/lib/api";

function template(overrides: Partial<TemplateSummary> = {}): TemplateSummary {
  return {
    id: "tpl-1",
    title: "Template BRD Standar",
    status: "READY",
    hasStructure: true,
    sectionCount: 8,
    error: null,
    updatedAt: "2026-09-19T00:00:00.000Z",
    ...overrides,
  };
}

function render(templates: TemplateSummary[]) {
  return renderToStaticMarkup(
    createElement(NewBrdPanel, {
      onGenerate: () => undefined,
      onImport: () => undefined,
      templates,
      selectedTemplateId: templates[0]?.id ?? null,
      onTemplateChange: () => undefined,
    }),
  );
}

describe("NewBrdPanel template picker", () => {
  it("shows the picker when more than one template is ready", () => {
    const html = render([
      template(),
      template({ id: "tpl-2", title: "Template Khusus", sectionCount: 5 }),
    ]);

    expect(html).toContain("Template struktur BRD");
    expect(html).toContain("Template Khusus (5 section)");
  });

  it("hides the picker when only one template is ready", () => {
    const html = render([template()]);

    expect(html).not.toContain("Template struktur BRD");
  });

  it("ignores templates that are still processing", () => {
    const html = render([
      template(),
      template({ id: "tpl-2", title: "Masih Diproses", status: "PROCESSING" }),
    ]);

    expect(html).not.toContain("Template struktur BRD");
  });
});