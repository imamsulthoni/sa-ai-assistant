import { describe, expect, it } from "vitest";
import { resolveMaxUploadBytes } from "./upload.js";

describe("resolveMaxUploadBytes", () => {
  it("falls back to the API default when unset", () => {
    expect(resolveMaxUploadBytes(undefined)).toBe(50 * 1024 * 1024);
    expect(resolveMaxUploadBytes("")).toBe(50 * 1024 * 1024);
  });

  it("accepts a positive override", () => {
    expect(resolveMaxUploadBytes("10485760")).toBe(10 * 1024 * 1024);
    expect(resolveMaxUploadBytes(2048)).toBe(2048);
  });

  it("rejects invalid values", () => {
    expect(resolveMaxUploadBytes("bukan-angka")).toBe(50 * 1024 * 1024);
    expect(resolveMaxUploadBytes("-1")).toBe(50 * 1024 * 1024);
    expect(resolveMaxUploadBytes("0")).toBe(50 * 1024 * 1024);
  });
});
