import { describe, expect, it } from "vitest";
import { isRecordNotFound } from "./prisma-errors.js";

describe("isRecordNotFound", () => {
  it("detects Prisma P2025 errors", () => {
    expect(isRecordNotFound({ code: "P2025" })).toBe(true);
  });

  it("ignores other errors and non-objects", () => {
    expect(isRecordNotFound({ code: "P2002" })).toBe(false);
    expect(isRecordNotFound(new Error("boom"))).toBe(false);
    expect(isRecordNotFound(null)).toBe(false);
  });
});
