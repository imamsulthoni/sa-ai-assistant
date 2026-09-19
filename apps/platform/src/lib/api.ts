import type {
  BrdDocument,
  BrdVersion,
  ClarificationQuestion,
  DocumentSummary,
  MessagesResponse,
  ProjectSummary,
  SearchResult,
  SessionSummary,
  Settings,
  SettingsResponse,
} from "./types.js";

export type {
  BrdDocument,
  BrdVersion,
  ClarificationQuestion,
  DocumentSummary,
  MessagesResponse,
  ProjectSummary,
  SearchResult,
  SessionSummary,
  Settings,
  SettingsResponse,
} from "./types.js";

/** Error HTTP dengan status + kode error server (mis. brd_exists). */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

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
    const code =
      detail && typeof detail === "object" && "code" in detail
        ? String((detail as { code?: unknown }).code)
        : undefined;
    throw new ApiError(
      `Request to ${path} failed (${response.status})`,
      response.status,
      code,
      { cause: detail },
    );
  }

  return (await response.json()) as T;
}

type ProjectResponse = { project: ProjectSummary };
type ProjectsResponse = { projects: ProjectSummary[] };

export function listProjects(): Promise<ProjectsResponse> {
  return request("/projects");
}

export function createProject(input: {
  name: string;
  description?: string | null;
  templateId?: string | null;
}): Promise<ProjectResponse> {
  return request("/projects", { method: "POST", body: JSON.stringify(input) });
}

export function getProject(id: string): Promise<ProjectResponse> {
  return request(`/projects/${encodeURIComponent(id)}`);
}

export function updateProject(
  id: string,
  input: { name?: string; description?: string | null; templateId?: string | null },
): Promise<ProjectResponse> {
  return request(`/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string): Promise<{ ok: boolean }> {
  return request(`/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function listSessions(projectId?: string): Promise<SessionsResponse> {
  const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return request(`/sessions${query}`);
}

export function createSession(input: { title?: string; projectId: string }): Promise<SessionResponse> {
  return request("/sessions", { method: "POST", body: JSON.stringify(input) });
}

export function renameSession(id: string, title: string): Promise<SessionResponse> {
  return request(`/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export function deleteSession(id: string): Promise<{ ok: boolean }> {
  return request(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function getSessionMessages(id: string): Promise<MessagesResponse> {
  return request(`/sessions/${encodeURIComponent(id)}/messages`);
}

export function listDocuments(
  sessionId: string,
  options: { scope?: "session" } = {},
): Promise<{ documents: DocumentSummary[] }> {
  const query = options.scope === "session" ? "?scope=session" : "";
  return request(`/documents${query}`, {
    headers: { "x-conversation-id": sessionId },
  });
}

export function uploadDocument(
  sessionId: string,
  file: File,
  options: { brdImport?: boolean } = {},
): Promise<{ document: DocumentSummary }> {
  const body = new FormData();
  body.set("file", file);
  if (options.brdImport) body.set("brdImport", "true");
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

export function listBrds(projectId: string): Promise<{ brds: BrdDocument[] }> {
  return request(`/brd?projectId=${encodeURIComponent(projectId)}`);
}

export function importBrd(input: {
  projectId: string;
  documentId: string;
  sessionId?: string;
  title?: string;
}): Promise<{ brd: BrdDocument }> {
  return request("/brd/import", { method: "POST", body: JSON.stringify(input) });
}

export function getBrd(id: string): Promise<{ brd: BrdDocument }> {
  return request(`/brd/${encodeURIComponent(id)}`);
}

export function createBrd(input: {
  projectId: string;
  sessionId?: string;
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

export function rejectBrdModification(id: string): Promise<{ brd: BrdDocument }> {
  return request(`/brd/${encodeURIComponent(id)}/reject-modification`, { method: "POST" });
}

export function updateBrdStatus(
  id: string,
  status: BrdDocument["status"],
): Promise<{ brd: BrdDocument }> {
  return request(`/brd/${encodeURIComponent(id)}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}

/** Parse a server download filename, including the RFC 5987 UTF-8 form. */
export function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

export async function exportBrd(id: string, format: "markdown" | "pdf"): Promise<void> {
  const response = await fetch(`${API_BASE}/brd/${encodeURIComponent(id)}/export/${format}`, {
    headers: { "x-user-id": DEMO_USER_ID },
  });
  if (!response.ok) throw new Error(`Export gagal (${response.status})`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(
    response.headers.get("content-disposition"),
    `brd.${format === "markdown" ? "md" : "pdf"}`,
  );
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getSettings(): Promise<SettingsResponse> {
  return request("/settings");
}

export function updateSettings(
  input: Partial<Settings> & { apiKey?: string | null },
): Promise<{ settings: Settings }> {
  return request("/settings", { method: "PATCH", body: JSON.stringify(input) });
}

export function uploadTemplate(file: File): Promise<{ document: DocumentSummary }> {
  const body = new FormData();
  body.set("file", file);
  return request("/settings/template", { method: "POST", body });
}

export function createManualTemplate(input: {
  title: string;
  templateStructure: unknown;
}): Promise<{ document: DocumentSummary }> {
  return request("/settings/template/manual", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getTemplate(
  id: string,
): Promise<{ document: DocumentSummary & { templateStructure?: unknown; error: string | null } }> {
  return request(`/settings/template/${encodeURIComponent(id)}`);
}

export function getCurrentTemplate(): Promise<{
  document: (DocumentSummary & { templateStructure?: unknown; error: string | null }) | null;
  activeTemplateId: string | null;
}> {
  return request("/settings/template");
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
  filters: { projectId?: string; sessionId?: string } = {},
): Promise<{ results: SearchResult[] }> {
  const params = new URLSearchParams({ q: query });
  if (type) params.set("type", type);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.sessionId) params.set("sessionId", filters.sessionId);
  return request(`/search?${params}`);
}

export type BrdFlowSnapshot = {
  phase: "CLARIFYING" | "GENERATING" | null;
  userStory: string | null;
  round: number;
  questions: ClarificationQuestion[];
  answers: Record<string, string>;
  pendingImportDocumentId: string | null;
};

export function getBrdFlow(projectId: string): Promise<{ flow: BrdFlowSnapshot | null }> {
  return request(`/brd/flow?projectId=${encodeURIComponent(projectId)}`);
}

export function importPendingBrd(sessionId: string): Promise<{ brd: BrdDocument }> {
  return request("/brd/flow/pending-import", {
    method: "POST",
    headers: { "x-conversation-id": sessionId },
  });
}

export function clearPendingImport(sessionId: string): Promise<{ ok: boolean }> {
  return request("/brd/flow/pending-import", {
    method: "DELETE",
    headers: { "x-conversation-id": sessionId },
  });
}

export type BrdFlowResponse =
  | {
      type: "clarification";
      round: number;
      clarification_questions: ClarificationQuestion[];
      capped: boolean;
    }
  | { type: "generating" }
  | {
      type: "brd";
      round: number;
      brd: BrdDocument;
      markdown: string;
      assumptions: string[];
      context: string;
    };

export function clarifyBrd(
  sessionId: string,
  input: { userStory: string; round?: number; answers?: Record<string, string> },
): Promise<Extract<BrdFlowResponse, { type: "clarification" }>> {
  return request("/brd/clarify", {
    method: "POST",
    headers: { "x-conversation-id": sessionId },
    body: JSON.stringify(input),
  });
}

export function submitClarification(
  sessionId: string,
  input: { userStory: string; answers: Record<string, string>; round?: number; skip?: boolean },
): Promise<BrdFlowResponse> {
  return request("/brd/submit-clarification", {
    method: "POST",
    headers: { "x-conversation-id": sessionId },
    body: JSON.stringify(input),
  });
}
