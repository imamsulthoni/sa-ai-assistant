import { describe, expect, it } from "vitest";
import { allowedToolsForPhase, getSystemAnalystToolNames, PHASE_ALLOWED_TOOLS } from "./agent.js";

describe("allowedToolsForPhase", () => {
  it("returns undefined for plain chat (all tools)", () => {
    expect(allowedToolsForPhase(undefined)).toBeUndefined();
  });

  it("gives JUDGE no tools because it only returns JSON", () => {
    expect(allowedToolsForPhase("JUDGE")).toEqual([]);
  });

  it("returns a defensive copy per phase", () => {
    const clarify = allowedToolsForPhase("CLARIFY");
    expect(clarify).toEqual([...PHASE_ALLOWED_TOOLS.CLARIFY]);
    clarify?.push("draft_brd");
    expect(allowedToolsForPhase("CLARIFY")).not.toContain("draft_brd");
  });

  it("keeps phases within their intended tools", () => {
    expect(allowedToolsForPhase("CLARIFY")).toContain("elicit_clarifications");
    expect(allowedToolsForPhase("CLARIFY")).not.toContain("modify_brd");
    expect(allowedToolsForPhase("GENERATE")).toContain("draft_brd");
    expect(allowedToolsForPhase("QA")).toContain("modify_brd");
    expect(allowedToolsForPhase("QA")).not.toContain("draft_brd");
  });
});

describe("getSystemAnalystToolNames", () => {
  it("never registers write tools", () => {
    const writePattern = /(?:save|write|persist|delete|publish|create_version|update_database)/i;
    expect(getSystemAnalystToolNames().filter((name) => writePattern.test(name))).toEqual([]);
  });

  it("does not include the removed flowchart verification tool", () => {
    expect(getSystemAnalystToolNames()).not.toContain("verify_flowchart");
  });
});
