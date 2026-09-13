import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { UseChatStatus } from "@anvia/react";
import { AnviaChat } from "#/modules/chat/anvia-chat";
import { ChatShell } from "#/modules/chat/chat-shell";
import { SessionSidebar } from "#/modules/chat/session-sidebar";
import { SettingsDialog } from "#/modules/settings/settings-page";
import { useSessions } from "#/modules/chat/hooks/use-sessions";
import { useDocuments } from "#/modules/chat/hooks/use-documents";
import { useBrds } from "#/modules/brd/hooks/use-brds";
import { useVersionHistory } from "#/modules/brd/hooks/use-version-history";
import { NewBrdPanel } from "#/modules/brd/new-brd-panel";
import { FeedbackForm, type ClarificationQuestion } from "#/modules/brd/feedback-form";
import { DocumentPane } from "#/modules/brd/document-pane";
import type { MentionAction } from "#/modules/brd/mention-popover";
import {
  clarifyBrd,
  createBrd,
  createBrdVersion,
  getBrd,
  submitClarification,
  uploadDocument,
  type BrdDocument,
  type SearchResult,
} from "#/lib/api";

type ChatSearch = { session?: string };
type Phase = "EMPTY_SESSION" | "CLARIFYING" | "GENERATING" | "BRD_ACTIVE";

function parseSession(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const Route = createFileRoute("/workspace")({
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    session: parseSession(search.session),
  }),
  component: Workspace,
});

function isStreaming(status: UseChatStatus): boolean {
  return status === "submitted" || status === "streaming" || status === "waiting";
}

function Workspace() {
  const { session } = Route.useSearch();
  const navigate = useNavigate();
  const onNavigate = useCallback(
    (id: string) => {
      void navigate({
        to: "/workspace",
        search: (prev) => ({ ...prev, session: id }),
      });
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
  const brdState = useBrds(activeId);
  const [phase, setPhase] = useState<Phase>("EMPTY_SESSION");
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [round, setRound] = useState(1);
  const [roundAnswers, setRoundAnswers] = useState<Record<string, string>>({});
  const [userStory, setUserStory] = useState("");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const history = useVersionHistory(brdState.active, (brd: BrdDocument) => {
    brdState.setActive(brd);
  });

  useEffect(() => {
    if (brdState.active) {
      setPhase("BRD_ACTIVE");
      setDraft(brdState.active.contentMarkdown);
    } else if (!brdState.loading) {
      setPhase((prev) => (prev === "BRD_ACTIVE" ? "EMPTY_SESSION" : prev));
    }
  }, [brdState.active, brdState.loading]);

  const persistV1 = useCallback(
    async (base: string, answers: Record<string, string>) => {
      if (!activeId || !base.trim()) throw new Error("Agent returned an empty BRD");
      setPhase("GENERATING");
      try {
        const created = await createBrd({
          sessionId: activeId,
          title: "New BRD",
          contentMarkdown: base.trim(),
          changeSummary: "Initial draft",
        });
        await brdState.select(created.brd.id);
        setDraft(created.brd.contentMarkdown);
        setPhase("BRD_ACTIVE");
      } catch (caught) {
        setFlowError(messageOf(caught));
        setPhase("CLARIFYING");
        throw caught;
      }
    },
    [activeId, brdState],
  );

  const runGeneration = useCallback(async (answers: Record<string, string>, force: boolean, story = userStory) => {
    if (!activeId) return;
    setPhase("GENERATING");
    try {
      const result = await submitClarification(activeId, { userStory: story, answers, round, skip: force });
      if (result.type === "clarification") {
        setQuestions(result.clarification_questions);
        setRound(result.round);
        setPhase("CLARIFYING");
        return;
      }
      setQuestions([]);
      await persistV1(result.markdown, answers);
    } catch (caught) { setFlowError(messageOf(caught)); setPhase("CLARIFYING"); }
  }, [activeId, persistV1, round, userStory]);

  const generate = useCallback(async (story: string, file?: File) => {
    if (!activeId) return;
    setFlowError(null);
    try {
      if (file) await uploadDocument(activeId, file);
      setUserStory(story);
      setRound(1);
      setRoundAnswers({});
      setPhase("GENERATING");
      const result = await clarifyBrd(activeId, { userStory: story, round: 1 });
      if (result.clarification_questions.length) {
        setQuestions(result.clarification_questions);
        setPhase("CLARIFYING");
      } else await runGeneration({}, true, story);
    } catch (caught) { setFlowError(`Unable to start BRD generation: ${messageOf(caught)}`); setPhase("EMPTY_SESSION"); }
  }, [activeId, runGeneration]);

  const submitAnswers = useCallback((answers: Record<string, string>) => {
    const merged = { ...roundAnswers, ...answers };
    setRoundAnswers(merged);
    void runGeneration(merged, false);
  }, [roundAnswers, runGeneration]);

  const skipClarification = useCallback(() => {
    setQuestions([]);
    void runGeneration(roundAnswers, true);
  }, [roundAnswers, runGeneration]);

  const retryClarification = useCallback(() => {
    setFlowError(null);
    setPhase("GENERATING");
    void clarifyBrd(activeId ?? "", { userStory, answers: roundAnswers, round }).then((result) => {
      setQuestions(result.clarification_questions);
      setPhase(result.clarification_questions.length ? "CLARIFYING" : "GENERATING");
    }).catch((caught) => { setFlowError(messageOf(caught)); setPhase("CLARIFYING"); });
  }, [activeId, round, roundAnswers, userStory]);
  const copyMention = useCallback(
    async (result: SearchResult) => {
      if (!activeId) return;
      setFlowError(null);
      try {
        const source = (await getBrd(result.id)).brd;
        const created = await createBrd({
          sessionId: activeId,
          title: `${source.title} (copy)`,
          contentMarkdown: source.contentMarkdown,
          changeSummary: `Copied from ${source.title}`,
        });
        for (const version of (source.versions ?? []).filter((v) => v.versionNumber > 1)) {
          await createBrdVersion(created.brd.id, {
            contentMarkdown: version.contentMarkdown,
            changeSummary: version.changeSummary ?? undefined,
            createdBy: version.createdBy === "AI_AGENT" ? "AI_AGENT" : "USER_MANUAL",
          });
        }
        await brdState.select(created.brd.id);
        setNotice(`Copied @${source.title} into this session as a new BRD.`);
      } catch (caught) {
        setFlowError(`Copy failed: ${messageOf(caught)}`);
      }
    },
    [activeId, brdState],
  );

  const pickMention = useCallback(
    (result: SearchResult, action: MentionAction) => {
      if (action === "copy") {
        void copyMention(result);
      } else {
        setNotice(
          `Referenced @${result.title} (read-only). Mention copy duplicates it into this session.`,
        );
      }
    },
    [copyMention],
  );

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
      headerAction={<SettingsDialog />}
    >
      {(error || brdState.error || flowError || history.error) && (
        <div className="mx-auto mt-4 w-full max-w-3xl rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {[error, brdState.error, flowError, history.error].filter(Boolean).join(" ")}
        </div>
      )}
      {notice && (
        <div className="mx-auto mt-4 flex w-full max-w-3xl items-center justify-between gap-2 rounded-md border bg-muted px-4 py-3 text-sm">
          <span>{notice}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {!activeId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loading ? "Loading…" : "No conversation selected"}
        </div>
      ) : brdState.active ? (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <AnviaChat
            key={activeId}
            sessionId={activeId}
            brdDocumentId={brdState.active.id}
            initialMessages={initialMessages}
            onRunEnded={refreshAfterRun}
            onStatusChange={(status) => setStreaming(isStreaming(status))}
            onMention={pickMention}
          />
          <DocumentPane
            brd={brdState.active}
            content={draft}
            diff={history.diff}
            onDiff={(from, to) => void history.showDiff(from, to)}
            onRestore={(version) => void history.restore(version)}
            onClearDiff={history.clearDiff}
            onApproved={(next) => { brdState.setActive(next); setDraft(next.contentMarkdown); }}
            busy={history.busy}
          />
        </div>
      ) : brdState.loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading conversation…
        </div>
      ) : phase === "CLARIFYING" ? (
        <FeedbackForm
          questions={questions}
          round={round}
          onSubmit={submitAnswers}
          onSkip={skipClarification}
        />
      ) : phase === "GENERATING" ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Generating BRD…
        </div>
      ) : (
        <NewBrdPanel
          onGenerate={(userStory, file) => void generate(userStory, file)}
          busy={streaming}
        />
      )}
    </ChatShell>
  );
}
