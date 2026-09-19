import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "@anvia/client";
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessionMessages,
  listSessions,
  renameSession as apiRenameSession,
  type SessionSummary,
} from "#/lib/api";
import { describeError } from "#/lib/errors";

const STORAGE_KEY = "sa.activeSession";

function storageKey(projectId: string): string {
  return `${STORAGE_KEY}.${projectId}`;
}

function messageOf(error: unknown): string {
  return describeError(error);
}

type UseSessionsOptions = {
  projectId: string;
  sessionId?: string | null;
  onNavigate?: (id: string) => void;
};

export function useSessions({ projectId, sessionId, onNavigate }: UseSessionsOptions) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const reqRef = useRef(0);
  const sessionsRef = useRef<SessionSummary[]>([]);

  const commitActive = useCallback(
    (id: string) => {
      activeRef.current = id;
      setActiveId(id);
      localStorage.setItem(storageKey(projectId), id);
      onNavigate?.(id);
    },
    [onNavigate, projectId],
  );

  // The anvia chat agent bootstraps from its own transport; the initial message
  // history for the active session must be ready before the chat mounts, so it
  // stays imperative instead of a query.
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
        setActionError(messageOf(caught));
        commitActive(id);
      }
    },
    [commitActive],
  );

  const sessionsQuery = useQuery({
    queryKey: ["sessions", projectId],
    queryFn: async () => {
      let sessions = (await listSessions(projectId)).sessions;
      if (sessions.length === 0) {
        sessions = [(await apiCreateSession({ projectId })).session];
      }
      return sessions;
    },
  });
  const sessions = sessionsQuery.data ?? [];

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const queryError = sessionsQuery.isError ? messageOf(sessionsQuery.error) : null;
  const error = actionError ?? queryError;
  const loading = sessionsQuery.isPending;

  // Pick the preferred session once the list is known: URL search > last used > first.
  useEffect(() => {
    activeRef.current = null;
    setActiveId(null);
    setInitialMessages([]);
  }, [projectId]);

  useEffect(() => {
    if (sessions.length === 0) return;
    const current = activeRef.current;
    if (current && sessions.some((item) => item.id === current)) return;
    const saved = localStorage.getItem(storageKey(projectId));
    const preferred =
      sessionId && sessions.some((item) => item.id === sessionId)
        ? sessionId
        : saved && sessions.some((item) => item.id === saved)
          ? saved
          : sessions[0].id;
    void activate(preferred);
  }, [sessions, sessionId, activate, projectId]);

  useEffect(() => {
    if (!sessionId) return;
    if (sessionId === activeRef.current) return;
    if (!sessionsRef.current.some((item) => item.id === sessionId)) return;
    void activate(sessionId);
  }, [sessionId, activate]);

  const createMutation = useMutation({
    mutationFn: () => apiCreateSession({ projectId }),
    onSuccess: async ({ session }) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      await activate(session.id);
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const newSession = useCallback(async () => {
    setActionError(null);
    await createMutation.mutateAsync();
  }, [createMutation]);

  const openSession = useCallback(
    (id: string) => {
      if (id === activeRef.current) return;
      void activate(id);
    },
    [activate],
  );

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => apiRenameSession(id, title),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const renameSession = useCallback(
    async (id: string, title: string) => {
      setActionError(null);
      await renameMutation.mutateAsync({ id, title });
    },
    [renameMutation],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const deleteSession = useCallback(
    async (id: string) => {
      setActionError(null);
      if (id === activeRef.current) {
        activeRef.current = null;
        setActiveId(null);
        setInitialMessages([]);
      }
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const refreshAfterRun = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["sessions", projectId] });
    } catch {
      // ignore transient refresh errors; the list is best-effort here
    }
  }, [queryClient, projectId]);

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