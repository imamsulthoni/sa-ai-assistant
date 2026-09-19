import { describe, expect, it } from "vitest";
import { agentCacheKey, agentFingerprint } from "./utils.js";

describe("agentCacheKey", () => {
  it("scopes the cache per user and session", () => {
    expect(agentCacheKey("u1", "s1")).toBe("u1:s1");
    expect(agentCacheKey("u1", "s2")).not.toBe(agentCacheKey("u1", "s1"));
  });
});

describe("agentFingerprint", () => {
  it("changes when the phase, BRD, template, or settings change", () => {
    const base = agentFingerprint("u1", "p1", "s1", "t0", "QA", "brd-1", "tpl-1", "tpl-t0");
    expect(agentFingerprint("u1", "p1", "s1", "t0", "CLARIFY", "brd-1", "tpl-1", "tpl-t0")).not.toBe(
      base,
    );
    expect(agentFingerprint("u1", "p1", "s1", "t0", "QA", "brd-2", "tpl-1", "tpl-t0")).not.toBe(base);
    expect(agentFingerprint("u1", "p1", "s1", "t0", "QA", "brd-1", "tpl-2", "tpl-t0")).not.toBe(base);
    expect(agentFingerprint("u1", "p1", "s1", "t1", "QA", "brd-1", "tpl-1", "tpl-t0")).not.toBe(base);
  });

  it("is stable for identical inputs and normalises missing values", () => {
    expect(agentFingerprint("u1", "p1", "s1", undefined, undefined)).toBe(
      agentFingerprint("u1", "p1", "s1", undefined, undefined),
    );
    expect(agentFingerprint("u1", "p1", "s1", undefined, undefined)).toContain("none");
  });
});
