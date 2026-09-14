import { describe, expect, it } from "vitest";
import { buildCompactDiff, countDiffChanges } from "./diff.js";

describe("buildCompactDiff", () => {
  it("marks removed and added lines with word-level segments", () => {
    const lines = buildCompactDiff("a\nb\nc", "a\nB\nc");
    expect(lines.find((line) => line.type === "removed")?.text).toBe("b");
    const added = lines.find((line) => line.type === "added");
    expect(added?.text).toBe("B");
    expect(added?.segments?.some((segment) => segment.changed)).toBe(true);
  });

  it("keeps context around changes and collapses the rest", () => {
    const before = Array.from({ length: 40 }, (_, index) => `line ${index}`).join("\n");
    const after = before.replace("line 20", "line 20 changed");
    const lines = buildCompactDiff(before, after);
    expect(lines.some((line) => line.text === "…")).toBe(true);
    expect(lines.length).toBeLessThan(15);
  });

  it("counts added and removed lines", () => {
    const lines = buildCompactDiff("a\nb", "a\nb\nc");
    expect(countDiffChanges(lines)).toEqual({ added: 1, removed: 0 });
  });
});
