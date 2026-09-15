import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-content.js";

describe("MarkdownContent", () => {
  it("renders headings, GFM tables, and inline code outside the chat context", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, {
        source:
          "# Judul\n\n## Bagian\n\n| Kolom | Nilai |\n| --- | --- |\n| FR-1 | Login |\n\nTeks `kode` dan **tebal**.",
      }),
    );
    expect(html).toContain("Bagian");
    expect(html).toContain("<table");
    expect(html).toContain("<code");
    expect(html).toContain("<strong");
  });

  it("shows the loading placeholder for a mermaid block", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { source: "```mermaid\ngraph TD; A-->B;\n```" }),
    );
    expect(html).toContain("Memuat diagram");
    expect(html).not.toContain("language-mermaid");
  });
});
