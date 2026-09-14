import { describe, expect, it } from "vitest";
import { filename, simpleDiff } from "./utils.js";

describe("simpleDiff", () => {
  it("keeps unchanged lines as context when a line is inserted", () => {
    const before = "a\nb\nc";
    const after = "a\nx\nb\nc";
    const diff = simpleDiff(before, after);
    expect(diff).toContain("+x");
    expect(diff).toContain(" b");
    expect(diff).not.toContain("-b");
    expect(diff).not.toContain("-c");
  });

  it("marks removed and added lines for replacements", () => {
    const diff = simpleDiff("a\nb\nc", "a\nB\nc");
    expect(diff).toContain("-b");
    expect(diff).toContain("+B");
  });

  it("handles pure additions and removals at the end", () => {
    expect(simpleDiff("a", "a\nb")).toContain("+b");
    expect(simpleDiff("a\nb", "a")).toContain("-b");
  });
});

describe("filename", () => {
  it("slugifies titles and falls back when empty", () => {
    expect(filename("BRD Cuti Karyawan", "pdf")).toBe("BRD-Cuti-Karyawan.pdf");
    expect(filename("***", "md")).toBe("brd.md");
  });
});
