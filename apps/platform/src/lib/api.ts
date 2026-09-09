import type { UIMessage } from "@anvia/client";

export const DEMO_USER_ID = "demo-user";

export const API_BASE =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};

type SessionResponse = { session: SessionSummary };
type SessionsResponse = { sessions: SessionSummary[] };
type MessagesResponse = { messages: UIMessage[] };

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-user-id", DEMO_USER_ID);
  if (init.method && init.method !== "GET" && !headers.has("content-type")) {
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
    throw new Error(
      `Request to ${path} failed (${response.status})`,
      { cause: detail },
    );
  }

  return (await response.json()) as T;
}

export function listSessions(): Promise<SessionsResponse> {
  return request("/sessions");
}

export function createSession(): Promise<SessionResponse> {
  return request("/sessions", { method: "POST", body: "{}" });
}

export function renameSession(
  id: string,
  title: string,
): Promise<SessionResponse> {
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
