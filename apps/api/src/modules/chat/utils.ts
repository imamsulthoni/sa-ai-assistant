import type { AgentPhase } from "./types.js";

export function agentCacheKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

export function agentFingerprint(
  userId: string,
  sessionId: string,
  settingsUpdatedAt: string | undefined,
  phase: AgentPhase | undefined,
  brdId?: string,
): string {
  return JSON.stringify([userId, sessionId, settingsUpdatedAt ?? "none", phase, brdId]);
}
