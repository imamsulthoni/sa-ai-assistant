import { describe, expect, it } from "vitest";
import { extractText, titleFromContent } from "./utils.js";

describe("extractText", () => {
  it("reads plain strings", () => {
    expect(extractText("halo")).toBe("halo");
  });

  it("joins text parts of a message content array", () => {
    expect(extractText([{ text: "halo" }, { image: "x" }, { text: "dunia" }])).toBe("halo dunia");
  });

  it("returns an empty string for unknown shapes", () => {
    expect(extractText(null)).toBe("");
    expect(extractText(42)).toBe("");
  });
});

describe("titleFromContent", () => {
  it("collapses whitespace into a single line", () => {
    expect(titleFromContent("  Ajukan   cuti\n tahunan  ")).toBe("Ajukan cuti tahunan");
  });

  it("truncates long titles with an ellipsis", () => {
    const long = "a".repeat(100);
    const title = titleFromContent(long);
    expect(title).toHaveLength(60);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("returns null when there is no text", () => {
    expect(titleFromContent("   ")).toBeNull();
    expect(titleFromContent([])).toBeNull();
  });
});
