import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "@anvia/client";
import {
  createSession,
  deleteSession as apiDeleteSession,
  getSessionMessages,
  listSessions,
  renameSession as apiRenameSession,
  type SessionSummary,
} from "#/lib/api";

const STORAGE_KEY = "sa.activeSession";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type UseSessionsOptions = {
  sessionId?: string | null;
  onNavigate?: (id: string) => void;
};

export function useSessions({ sessionId, onNavigate }: UseSessionsOptions = {}) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const reqRef = useRef(0);
  const sessionsRef = useRef<SessionSummary[]>([]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const commitActive = useCallback(
    (id: string) => {
      activeRef.current = id;
      setActiveId(id);
      localStorage.setItem(STORAGE_KEY, id);
      onNavigate?.(id);
    },
    [onNavigate],
  );

  const activate = useCallback(
    async (id: string) => {
      const request = ++reqRef.current;
      try {
        const { messages } = await getSessionMessages(id);
        if (request !== reqRef.current) return;
        setInitialMessages(messages);
        commitActive(id);
      } catch (caught) {
        if (request !== reqRef.current) return;
        setError(messageOf(caught));
        commitActive(id);
      }
    },
    [commitActive],
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let next = await listSessions().then((r) => r.sessions);
      if (next.length === 0) {
        const { session } = await createSession();
        next = [session];
      }
      setSessions(next);
      sessionsRef.current = next;
      const saved = localStorage.getItem(STORAGE_KEY);
      const preferred =
        sessionId && next.some((s) => s.id === sessionId)
          ? sessionId
          : saved && next.some((s) => s.id === saved)
            ? saved
            : next[0].id;
      await activate(preferred);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [sessionId, activate]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!sessionId) return;
    if (sessionId === activeRef.current) return;
    if (!sessionsRef.current.some((s) => s.id === sessionId)) return;
    void activate(sessionId);
  }, [sessionId, activate]);

  const newSession = useCallback(async () => {
    setError(null);
    try {
      const { session } = await createSession();
      setSessions((prev) => [session, ...prev]);
      sessionsRef.current = [session, ...sessionsRef.current];
      await activate(session.id);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [activate]);

  const openSession = useCallback(
    (id: string) => {
      if (id === activeRef.current) return;
      void activate(id);
    },
    [activate],
  );

  const renameSession = useCallback(async (id: string, title: string) => {
    setError(null);
    try {
      const { session } = await apiRenameSession(id, title);
      setSessions((prev) => prev.map((s) => (s.id === id ? session : s)));
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  const deleteSession = useCallback(
    async (id: string) => {
      setError(null);
      try {
        await apiDeleteSession(id);
        let next = sessionsRef.current.filter((s) => s.id !== id);
        setSessions(next);
        sessionsRef.current = next;
        if (id === activeRef.current) {
          if (next.length === 0) {
            const { session } = await createSession();
            next = [session];
            setSessions(next);
            sessionsRef.current = next;
          }
          await activate(next[0].id);
        }
      } catch (caught) {
        setError(messageOf(caught));
      }
    },
    [activate],
  );

  const refreshAfterRun = useCallback(async () => {
    try {
      const next = await listSessions().then((r) => r.sessions);
      setSessions(next);
      sessionsRef.current = next;
    } catch {
      // ignore transient refresh errors; the list is best-effort here
    }
  }, []);

  return {
    sessions,
    activeId,
    initialMessages,
    loading,
    error,
    newSession,
    openSession,
    renameSession,
    deleteSession,
    refreshAfterRun,
  };
}
