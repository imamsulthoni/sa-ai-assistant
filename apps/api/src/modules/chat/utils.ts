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
  const story = userStory.trim().toLowerCase();
  const substantiveAnswers = Object.values(answers)
    .map((answer) => answer.trim().toLowerCase())
    .filter((answer) => answer.length >= 8 && !/^(tidak ada|tidak tahu|belum tahu|n\/a|none|-)$/.test(answer));
  if (story.length < 120 || substantiveAnswers.length < 3) return false;

  const evidence = `${story} ${substantiveAnswers.join(" ")}`;
  const dimensions = [
    /\b(staf|admin|operator|supervisor|spv|user|aktor|role|pengguna)\b/.test(evidence),
    /\b(ajuk|pengajuan|mengajukan|proses|alur|setuju|menyetujui|tolak|menolak|approval|persetujuan|status)\b/.test(evidence),
    /\b(wajib|validasi|tanggal|jumlah|field|data|informasi|input|aturan)\b/.test(evidence),
    /\b(berhasil|sukses|hasil|kriteria|diterima|disimpan|selesai|outcome)\b/.test(evidence),
  ];
  return dimensions.filter(Boolean).length >= 4;
}

export function clarificationNeedsFinalRound(userStory: string, answers: Record<string, string>): boolean {
  if (clarificationGateHeuristically(userStory, answers)) return false;
  const normalized = `${userStory} ${Object.values(answers).join(" ")}`.toLowerCase();
  const requiredSignals = [
    /\b(aktor|role|pengguna|staf|admin|operator|supervisor|spv)\b/.test(normalized),
    /\b(scope|ruang lingkup|tujuan|ingin|agar|hasil)\b/.test(normalized),
    /\b(alur|proses|approval|persetujuan|setuju|menolak|status)\b/.test(normalized),
    /\b(validasi|wajib|field|data|informasi|tanggal|jumlah)\b/.test(normalized),
    /\b(berhasil|sukses|kriteria|disimpan|selesai|error|gagal|ditolak)\b/.test(normalized),
  ];
  return requiredSignals.filter(Boolean).length < requiredSignals.length;
}
