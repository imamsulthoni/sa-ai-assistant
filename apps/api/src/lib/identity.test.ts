import { describe, expect, it } from "vitest";
import { DEMO_USER_ID, resolveUserId } from "./identity.js";

describe("resolveUserId", () => {
  it("falls back to the demo user", () => {
    expect(resolveUserId(undefined)).toBe(DEMO_USER_ID);
    expect(resolveUserId(null)).toBe(DEMO_USER_ID);
    expect(resolveUserId("   ")).toBe(DEMO_USER_ID);
  });

  it("trims a provided user id", () => {
    expect(resolveUserId("  user-1 ")).toBe("user-1");
  });
});
