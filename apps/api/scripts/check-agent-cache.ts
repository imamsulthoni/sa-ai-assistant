import { agentCacheKey, agentFingerprint } from "../src/modules/chat/router.js";

const first = agentFingerprint("user-1", "session-1", "2026-09-11T10:00:00.000Z", "QA", "brd-1");
const changedPrompt = agentFingerprint("user-1", "session-1", "2026-09-11T10:01:00.000Z", "QA", "brd-1");
const otherSession = agentFingerprint("user-1", "session-2", "2026-09-11T10:00:00.000Z", "QA", "brd-1");

if (first === changedPrompt) throw new Error("Settings changes did not invalidate the agent fingerprint");
if (first === otherSession) throw new Error("Session context is not isolated in the agent fingerprint");
if (agentCacheKey("user-1", "session-1") === agentCacheKey("user-1", "session-2")) {
  throw new Error("Agent cache keys are not session-scoped");
}

console.log("agent cache regression: PASS");
