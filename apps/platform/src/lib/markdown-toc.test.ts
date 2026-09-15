import { describe, expect, it } from "vitest";
import { buildToc, slugify } from "./markdown-toc.js";

describe("slugify", () => {
  it("keeps letters and numbers", () => {
    expect(slugify("Ruang Lingkup & Batasan")).toBe("ruang-lingkup-batasan");
    expect(slugify("4.0 Kebutuhan Non-Fungsional")).toBe("4-0-kebutuhan-non-fungsional");
  });

  it("falls back when nothing is sluggable", () => {
    expect(slugify("***")).toBe("bagian");
  });
});

describe("buildToc", () => {
  it("collects h2-h4 with line numbers and unique slugs", () => {
    const markdown = ["# Judul", "## Ruang Lingkup", "### Detail", "## Ruang Lingkup"].join("\n");
    expect(buildToc(markdown)).toEqual([
      { level: 2, text: "Ruang Lingkup", slug: "ruang-lingkup", line: 2 },
      { level: 3, text: "Detail", slug: "detail", line: 3 },
      { level: 2, text: "Ruang Lingkup", slug: "ruang-lingkup-1", line: 4 },
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const markdown = ["```md", "## Bukan Heading", "```", "## Heading Asli"].join("\n");
    expect(buildToc(markdown).map((item) => item.text)).toEqual(["Heading Asli"]);
  });

  it("strips inline formatting from the label", () => {
    const markdown = "### **Dampak** `Operasional`";
    expect(buildToc(markdown)[0]).toMatchObject({
      text: "Dampak Operasional",
      slug: "dampak-operasional",
    });
  });
});
