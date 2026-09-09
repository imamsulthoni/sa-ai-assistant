import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { UseChatStatus } from "@anvia/react";
import { AnviaChat } from '#/components/chat/anvia-chat'
import { ChatShell } from '#/components/chat/chat-shell'
import { SessionSidebar } from '#/components/chat/session-sidebar'
import { useSessions } from '#/hooks/use-sessions'
import { useDocuments } from '#/hooks/use-documents'

type ChatSearch = { session?: string };

function parseSession(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    session: parseSession(search.session),
  }),
  component: Home,
});

function isStreaming(status: UseChatStatus): boolean {
  return status === 'submitted' || status === 'streaming' || status === 'waiting'
}

function Home() {
  const { session } = Route.useSearch();
  const navigate = useNavigate();
  const onNavigate = useCallback(
    (id: string) => {
      void navigate({ to: '/', search: (prev) => ({ ...prev, session: id }) });
    },
    [navigate],
  );
  const {
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
  } = useSessions({ sessionId: session, onNavigate });
  const documentState = useDocuments(activeId);
  const [streaming, setStreaming] = useState(false)

  return (
    <ChatShell
      sidebar={
        <SessionSidebar
          sessions={sessions}
          activeId={activeId}
          loading={loading}
          disabled={streaming}
          onNew={() => void newSession()}
          onOpen={(id) => openSession(id)}
          onRename={(id, title) => void renameSession(id, title)}
           onDelete={(id) => void deleteSession(id)}
           documents={documentState.documents}
           documentsLoading={documentState.loading}
           documentsUploading={documentState.uploading}
           documentsError={documentState.error}
           onUploadDocuments={(files) => void documentState.upload(files)}
           onDeleteDocument={(id) => void documentState.remove(id)}
         />
      }
    >
      {error && (
        <div className="mx-auto mt-4 max-w-3xl rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {activeId ? (
        <AnviaChat
          key={activeId}
          sessionId={activeId}
          initialMessages={initialMessages}
          onRunEnded={refreshAfterRun}
          onStatusChange={(status) => setStreaming(isStreaming(status))}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loading ? 'Loading…' : 'No conversation selected'}
        </div>
      )}
    </ChatShell>
  )
}
