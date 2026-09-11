import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import type { UseChatStatus } from "@anvia/react";
import { AnviaChat } from "#/components/chat/anvia-chat";
import { ChatShell } from "#/components/chat/chat-shell";
import { SessionSidebar } from "#/components/chat/session-sidebar";
import { SettingsDialog } from "#/components/settings/settings-page";
import { useSessions } from "#/hooks/use-sessions";
import { useDocuments } from "#/hooks/use-documents";
import { useBrds } from "#/hooks/use-brds";
import { useVersionHistory } from "#/hooks/use-version-history";
import { NewBrdPanel } from "#/components/brd/new-brd-panel";
import { FeedbackForm, type ClarificationQuestion } from "#/components/brd/feedback-form";
import { DocumentPane } from "#/components/brd/document-pane";
import { VersionHistory } from "#/components/brd/version-history";
import type { MentionAction } from "#/components/brd/mention-popover";
import {
  createBrd,
  createBrdVersion,
  getBrd,
  uploadDocument,
  type BrdDocument,
  type SearchResult,
} from "#/lib/api";

type ChatSearch = { session?: string };
type Phase = "EMPTY_SESSION" | "CLARIFYING" | "GENERATING" | "BRD_ACTIVE";

// Scaffold batches in the exact `clarification_questions` shape from PRD §4B.
// Full integration parses these from the agent stream (S5); the form contract is identical.
const ROUND_1_QUESTIONS: ClarificationQuestion[] = [
  {
    id: "outcome",
    question: "What is the primary business outcome?",
    options: ["Reduce manual work", "Improve control and auditability", "Enable new capability"],
    required: true,
  },
  {
    id: "failure",
    question: "What should happen when the main operation fails?",
    options: ["Retry automatically", "Show an actionable error", "Escalate to an operator"],
    required: true,
  },
];

const ROUND_2_QUESTIONS: ClarificationQuestion[] = [
  {
    id: "auth",
    question: "Who is allowed to perform this operation?",
    options: ["Any authenticated user", "Specific role only", "System-to-system"],
    required: true,
  },
  {
    id: "limit",
    question: "Are there transaction limits or SLAs to capture?",
    options: ["No explicit limit", "Time-bounded (define SLA)", "Volume-bounded (define quota)"],
    required: false,
  },
];

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
      void navigate({ to: "/workspace", search: (prev) => ({ ...prev, session: id }) });
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

  const generate = useCallback(
    async (userStory: string, file?: File) => {
      if (!activeId) return;
      setFlowError(null);
      try {
        if (file) await uploadDocument(activeId, file);
      } catch (caught) {
        setFlowError(`Reference upload failed: ${messageOf(caught)}`);
        return;
      }
      setRound(1);
      setRoundAnswers({});
      setQuestions(ROUND_1_QUESTIONS);
      setDraft(
        `# BRD draft\n\n## User Story\n${userStory}\n\n## ASSUMPTIONS\n- Clarifications pending.`,
      );
      setPhase("CLARIFYING");
    },
    [activeId],
  );

  const persistV1 = useCallback(
    async (base: string, answers: Record<string, string>) => {
      if (!activeId) return;
      setPhase("GENERATING");
      try {
        const lines = Object.entries(answers).map(([key, value]) => `- ${key}: ${value}`);
        const content = `${base}\n\n## Clarifications\n${lines.length ? lines.join("\n") : "- (skipped — see ASSUMPTIONS)"}`;
        const created = await createBrd({
          sessionId: activeId,
          title: "New BRD",
          contentMarkdown: content,
          changeSummary: "Initial draft",
        });
        await brdState.select(created.brd.id);
        setDraft(created.brd.contentMarkdown);
        setPhase("BRD_ACTIVE");
      } catch (caught) {
        setFlowError(messageOf(caught));
        setPhase("CLARIFYING");
      }
    },
    [activeId, brdState],
  );

  const submitAnswers = useCallback(
    (answers: Record<string, string>) => {
      const merged = { ...roundAnswers, ...answers };
      setRoundAnswers(merged);
      if (round < 2) {
        setRound(2);
        setQuestions(ROUND_2_QUESTIONS);
        return;
      }
      setQuestions([]);
      void persistV1(draft, merged);
    },
    [round, roundAnswers, draft, persistV1],
  );

  const skipClarification = useCallback(() => {
    setQuestions([]);
    void persistV1(draft, roundAnswers);
  }, [draft, roundAnswers, persistV1]);

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
      ) : phase === "EMPTY_SESSION" ? (
        <NewBrdPanel
          onGenerate={(userStory, file) => void generate(userStory, file)}
          busy={streaming}
        />
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
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <AnviaChat
            key={activeId}
            sessionId={activeId}
            initialMessages={initialMessages}
            onRunEnded={refreshAfterRun}
            onStatusChange={(status) => setStreaming(isStreaming(status))}
            onMention={pickMention}
          />
          {brdState.active && (
            <DocumentPane
              brd={brdState.active}
              content={draft}
              onChange={setDraft}
              onSave={() => void history.save(draft)}
              busy={history.busy}
            />
          )}
          {brdState.active && (
            <VersionHistory
              brd={brdState.active}
              diff={history.diff}
              onDiff={(from, to) => void history.showDiff(from, to)}
              onRestore={(version) => void history.restore(version)}
            />
          )}
        </div>
      )}
    </ChatShell>
  );
}
