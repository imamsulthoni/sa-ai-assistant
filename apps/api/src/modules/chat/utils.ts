import type { AgentPhase } from "./types.js";

export function agentCacheKey(userId: string, scopeId: string): string {
  return `${userId}:${scopeId}`;
}

export function agentFingerprint(
  userId: string,
  projectId: string,
  sessionId: string | undefined,
  settingsUpdatedAt: string | undefined,
  phase: AgentPhase | undefined,
  brdId?: string,
  templateId = "none",
  templateUpdatedAt = "none",
): string {
  return JSON.stringify([
    userId,
    projectId,
    sessionId,
    settingsUpdatedAt ?? "none",
    phase,
    brdId,
    templateId,
    templateUpdatedAt,
  ]);
}
