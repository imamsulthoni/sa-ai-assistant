import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UIMessage } from "@anvia/client";
import {
  createSession as apiCreateSession,
  deleteSession as apiDeleteSession,
  getSessionMessages,
  listSessions,
  renameSession as apiRenameSession,
  updateSessionTemplate as apiUpdateSessionTemplate,
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
      localStorage.setItem(STORAGE_KEY, id);
      onNavigate?.(id);
    },
    [onNavigate],
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
    queryKey: ["sessions"],
    queryFn: async () => {
      let sessions = (await listSessions()).sessions;
      if (sessions.length === 0) {
        sessions = [(await apiCreateSession()).session];
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
    if (sessions.length === 0) return;
    const current = activeRef.current;
    if (current && sessions.some((item) => item.id === current)) return;
    const saved = localStorage.getItem(STORAGE_KEY);
    const preferred =
      sessionId && sessions.some((item) => item.id === sessionId)
        ? sessionId
        : saved && sessions.some((item) => item.id === saved)
          ? saved
          : sessions[0].id;
    void activate(preferred);
  }, [sessions, sessionId, activate]);

  useEffect(() => {
    if (!sessionId) return;
    if (sessionId === activeRef.current) return;
    if (!sessionsRef.current.some((item) => item.id === sessionId)) return;
    void activate(sessionId);
  }, [sessionId, activate]);

  const createMutation = useMutation({
    mutationFn: () => apiCreateSession(),
    onSuccess: async ({ session }) => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      await activate(session.id);
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const newSession = useCallback(async () => {
    setActionError(null);
    await createMutation.mutateAsync();
  }, [createMutation, activate]);

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
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
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

  const templateMutation = useMutation({
    mutationFn: ({ id, templateId }: { id: string; templateId: string | null }) =>
      apiUpdateSessionTemplate(id, { templateId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const updateSessionTemplate = useCallback(
    async (id: string, templateId: string | null) => {
      setActionError(null);
      await templateMutation.mutateAsync({ id, templateId });
    },
    [templateMutation],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDeleteSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const deleteSession = useCallback(
    async (id: string) => {
      setActionError(null);
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const refreshAfterRun = useCallback(async () => {
    try {
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
    } catch {
      // ignore transient refresh errors; the list is best-effort here
    }
  }, [queryClient]);

  return {
    sessions,
    activeId,
    initialMessages,
    loading,
    error,
    newSession,
    openSession,
    renameSession,
    updateSessionTemplate,
    deleteSession,
    refreshAfterRun,
  };
}
