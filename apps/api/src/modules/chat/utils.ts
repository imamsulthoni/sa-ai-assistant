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
  templateId = "none",
  templateUpdatedAt = "none",
): string {
  return JSON.stringify([
    userId,
    sessionId,
    settingsUpdatedAt ?? "none",
    phase,
    brdId,
    templateId,
    templateUpdatedAt,
  ]);
}

export function clarificationGateHeuristically(userStory: string, answers: Record<string, string>): boolean {
  const story = userStory.trim();
  const answered = Object.values(answers).filter((answer) => answer.trim()).length;
  return story.length >= 80 && answered > 0;
}
