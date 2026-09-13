import type {
  BrdDocument,
  BrdVersion,
  ClarificationQuestion,
  DocumentSummary,
  MessagesResponse,
  SearchResult,
  SessionSummary,
  Settings,
} from "./types.js";

export type {
  BrdDocument,
  BrdVersion,
  ClarificationQuestion,
  DocumentSummary,
  MessagesResponse,
  SearchResult,
  SessionSummary,
  Settings,
} from "./types.js";

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const DEMO_USER_ID = "demo-user";

type SessionResponse = { session: SessionSummary };
type SessionsResponse = { sessions: SessionSummary[] };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-user-id", DEMO_USER_ID);
  if (
    init.method &&
    init.method !== "GET" &&
    !headers.has("content-type") &&
    !(init.body instanceof FormData)
  ) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = await response.json();
    } catch {
      detail = await response.text();
    }
    throw new Error(`Request to ${path} failed (${response.status})`, { cause: detail });
  }

  return (await response.json()) as T;
}

export function listSessions(): Promise<SessionsResponse> {
  return request("/sessions");
}

export function createSession(
  input: { projectId?: string; templateId?: string } = {},
): Promise<SessionResponse> {
  return request("/sessions", { method: "POST", body: JSON.stringify(input) });
}

export function renameSession(id: string, title: string): Promise<SessionResponse> {
  return request(`/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function updateSessionTemplate(
  id: string,
  input: { projectId?: string | null; templateId?: string | null },
): Promise<SessionResponse> {
  return request(`/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getSessionMessages(id: string): Promise<MessagesResponse> {
  return request(`/sessions/${encodeURIComponent(id)}/messages`);
}

export function listDocuments(sessionId: string): Promise<{ documents: DocumentSummary[] }> {
  return request("/documents", {
    headers: { "x-conversation-id": sessionId },
  });
}

export function uploadDocument(
  sessionId: string,
  file: File,
): Promise<{ document: DocumentSummary }> {
  const body = new FormData();
  body.set("file", file);
  return request("/documents", {
    method: "POST",
    body,
    headers: { "x-conversation-id": sessionId },
  });
}

export function getDocument(
  sessionId: string,
  id: string,
): Promise<{ document: DocumentSummary & { error: string | null } }> {
  return request(`/documents/${encodeURIComponent(id)}`, {
    headers: { "x-conversation-id": sessionId },
  });
}

export function deleteDocument(sessionId: string, id: string): Promise<{ ok: boolean }> {
  return request(`/documents/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "x-conversation-id": sessionId },
  });
}

export function listBrds(sessionId: string): Promise<{ brds: BrdDocument[] }> {
  return request(`/brd?sessionId=${encodeURIComponent(sessionId)}`);
}

export function importBrd(input: {
  sessionId: string;
  documentId: string;
  title?: string;
}): Promise<{ brd: BrdDocument }> {
  return request("/brd/import", { method: "POST", body: JSON.stringify(input) });
}

export function getBrd(id: string): Promise<{ brd: BrdDocument }> {
  return request(`/brd/${encodeURIComponent(id)}`);
}

export function createBrd(input: {
  sessionId: string;
  title: string;
  contentMarkdown: string;
  changeSummary?: string;
}): Promise<{ brd: BrdDocument }> {
  return request("/brd", { method: "POST", body: JSON.stringify(input) });
}

export function createBrdVersion(
  id: string,
  input: {
    contentMarkdown: string;
    changeSummary?: string;
    createdBy?: "USER_MANUAL" | "AI_AGENT";
  },
): Promise<{ version: BrdVersion }> {
  return request(`/brd/${encodeURIComponent(id)}/versions`, {
    method: "POST",
    body: JSON.stringify({ createdBy: "USER_MANUAL", ...input }),
  });
}

export function getBrdDiff(
  id: string,
  from: number,
  to: number,
): Promise<{ from: number; to: number; diff: string }> {
  return request(`/brd/${encodeURIComponent(id)}/diff?from=${from}&to=${to}`);
}

export function restoreBrd(
  id: string,
  version: number,
): Promise<{ currentVersion: number; contentMarkdown: string }> {
  return request(`/brd/${encodeURIComponent(id)}/restore`, {
    method: "POST",
    body: JSON.stringify({ version }),
  });
}

export function approveBrdModification(id: string): Promise<{ brd: BrdDocument }> {
  return request(`/brd/${encodeURIComponent(id)}/approve-modification`, { method: "POST" });
}

export function rejectBrdModification(id: string): Promise<{ ok: boolean }> {
  return request(`/brd/${encodeURIComponent(id)}/reject-modification`, { method: "POST" });
}

export async function exportBrd(id: string, format: "markdown" | "pdf"): Promise<void> {
  const response = await fetch(`${API_BASE}/brd/${encodeURIComponent(id)}/export/${format}`, {
    headers: { "x-user-id": DEMO_USER_ID },
  });
  if (!response.ok) throw new Error(`Export failed (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `brd.${format === "markdown" ? "md" : "pdf"}`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getSettings(): Promise<{ settings: Settings | null }> {
  return request("/settings");
}

export function updateSettings(
  input: Partial<Settings> & { apiKey?: string },
): Promise<{ settings: Settings }> {
  return request("/settings", { method: "PATCH", body: JSON.stringify(input) });
}

export function uploadTemplate(file: File): Promise<{ document: DocumentSummary }> {
  const body = new FormData();
  body.set("file", file);
  return request("/settings/template", { method: "POST", body });
}

export function getTemplate(
  id: string,
): Promise<{ document: DocumentSummary & { templateStructure?: unknown; error: string | null } }> {
  return request(`/settings/template/${encodeURIComponent(id)}`);
}

export function approveTemplate(id: string): Promise<{ ok: boolean; activeTemplateId: string }> {
  return request(`/settings/template/${encodeURIComponent(id)}/approve`, { method: "POST" });
}

export function rejectTemplate(id: string): Promise<{ ok: boolean }> {
  return request(`/settings/template/${encodeURIComponent(id)}/reject`, { method: "POST" });
}

export function updateTemplateStructure(
  id: string,
  templateStructure: unknown,
): Promise<{ document: DocumentSummary & { templateStructure?: unknown; error: string | null } }> {
  return request(`/settings/template/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ templateStructure }),
  });
}

export function resetTemplate(): Promise<{ ok: boolean }> {
  return request("/settings/template/reset", { method: "POST" });
}

export function search(
  query: string,
  type?: "brd" | "document",
  sessionId?: string,
): Promise<{ results: SearchResult[] }> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  if (sessionId) params.set("sessionId", sessionId);
  return request(`/search?${params}`);
}

export type BrdFlowResponse =
  | { type: "clarification"; round: number; clarification_questions: ClarificationQuestion[]; capped: boolean }
  | { type: "brd"; round: number; markdown: string; assumptions: string[]; context: string };

export function clarifyBrd(sessionId: string, input: { userStory: string; round?: number; answers?: Record<string, string> }): Promise<Extract<BrdFlowResponse, { type: "clarification" }>> {
  return request("/brd/clarify", { method: "POST", headers: { "x-conversation-id": sessionId }, body: JSON.stringify(input) });
}

export function submitClarification(sessionId: string, input: { userStory: string; answers: Record<string, string>; round?: number; skip?: boolean }): Promise<BrdFlowResponse> {
  return request("/brd/submit-clarification", { method: "POST", headers: { "x-conversation-id": sessionId }, body: JSON.stringify(input) });
}
