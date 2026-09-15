import { describe, expect, it } from "vitest";
import { relativeTime } from "./time.js";

const now = new Date("2026-09-16T10:00:00.000Z").getTime();

describe("relativeTime", () => {
  it("returns Baru saja for fresh timestamps", () => {
    expect(relativeTime(new Date(now - 10_000).toISOString(), now)).toBe("Baru saja");
  });

  it("formats minutes and hours in Indonesian", () => {
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 menit lalu");
    expect(relativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3 jam lalu");
    expect(relativeTime(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe("2 hari lalu");
  });

  it("falls back to an absolute date for old timestamps", () => {
    const result = relativeTime(new Date(now - 90 * 86_400_000).toISOString(), now);
    expect(result).toMatch(/2026/);
  });

  it("returns an empty string for invalid input", () => {
    expect(relativeTime("bukan-tanggal", now)).toBe("");
  });
});
