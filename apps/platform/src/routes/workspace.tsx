import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, LoaderCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "#/lib/utils";
import type { UseChatStatus } from "@anvia/react";
import { AnviaChat } from "#/modules/chat/anvia-chat";
import { ChatShell } from "#/modules/chat/chat-shell";
import { SessionSidebar } from "#/modules/chat/session-sidebar";
import { SettingsDialog } from "#/modules/settings/settings-page";
import { useSessions } from "#/modules/chat/hooks/use-sessions";
import { useDocuments } from "#/modules/chat/hooks/use-documents";
import { useBrds } from "#/modules/brd/hooks/use-brds";
import { useBrdFlow } from "#/modules/brd/hooks/use-brd-flow";
import { useVersionHistory } from "#/modules/brd/hooks/use-version-history";
import { NewBrdPanel } from "#/modules/brd/new-brd-panel";
import { FeedbackForm, type ClarificationQuestion } from "#/modules/brd/feedback-form";
import { DocumentPane } from "#/modules/brd/document-pane";
import { Alert } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  clarifyBrd,
  importPendingBrd,
  submitClarification,
  uploadDocument,
  type BrdDocument,
} from "#/lib/api";
import { COPY } from "#/lib/copy";
import { waitForDocumentReady } from "#/lib/documents";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";

type ChatSearch = { session?: string };
type Phase = "EMPTY_SESSION" | "CLARIFYING" | "GENERATING" | "BRD_ACTIVE";
type GenerationMode = "local" | "remote" | "resumable" | null;

const GENERATION_POLL_MS = 3000;
const GENERATION_POLL_TIMEOUT_MS = 5 * 60_000;

function parseSession(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function messageOf(error: unknown): string {
  return describeError(error);
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

type StepKey = "story" | "clarify" | "generate";

const FLOW_STEPS: Array<{ key: StepKey; label: string }> = COPY.flow.steps.map((step) => ({
  key: step.key as StepKey,
  label: step.label,
}));

function FlowSteps({ current }: { current: StepKey }) {
  const index = FLOW_STEPS.findIndex((step) => step.key === current);
  return (
    <ol className="flex shrink-0 items-center gap-2 border-b border-border/70 bg-card/70 px-4 py-2.5 md:px-6">
      {FLOW_STEPS.map((step, stepIndex) => {
        const done = stepIndex < index;
        const active = stepIndex === index;
        return (
          <li key={step.key} className="flex items-center gap-2">
            {stepIndex > 0 && (
              <span
                className={cn("h-px w-6 bg-border sm:w-12", stepIndex <= index && "bg-primary/40")}
              />
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full text-[10px] font-bold",
                  done && "bg-primary text-primary-foreground",
                  active && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check size={11} /> : stepIndex + 1}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const BRD_SHARE_MIN = 0.3;
const BRD_SHARE_MAX = 0.7;

function clampBrdShare(share: number): number {
  return Math.min(BRD_SHARE_MAX, Math.max(BRD_SHARE_MIN, share));
}

/**
 * Keyboard- and pointer-accessible vertical splitter between the chat agent
 * and the BRD document pane. Controlled by the parent so ARIA value stays in sync.
 */
function SplitResizer({
  containerRef,
  share,
  onResize,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  share: number;
  onResize: (share: number) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const bounds = container.getBoundingClientRect();
    setDragging(true);
    const move = (clientX: number) => {
      const next = (bounds.right - clientX) / bounds.width;
      onResize(clampBrdShare(next));
    };
    move(event.clientX);
    const onPointerMove = (pointerEvent: PointerEvent) => move(pointerEvent.clientX);
    const onPointerUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const step = (direction: 1 | -1) => onResize(clampBrdShare(share + direction * 0.05));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={COPY.workspace.resizePanes}
      aria-valuemin={Math.round(BRD_SHARE_MIN * 100)}
      aria-valuemax={Math.round(BRD_SHARE_MAX * 100)}
      aria-valuenow={Math.round(share * 100)}
      aria-valuetext={COPY.workspace.brdPaneValue(Math.round(share * 100))}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          step(-1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          step(1);
        } else if (event.key === "Home") {
          event.preventDefault();
          onResize(BRD_SHARE_MIN);
        } else if (event.key === "End") {
          event.preventDefault();
          onResize(BRD_SHARE_MAX);
        }
      }}
      className={cn(
        "hidden w-1.5 shrink-0 cursor-col-resize touch-none items-stretch justify-center bg-border/70 transition-colors hover:bg-primary/50 focus-visible:bg-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 lg:flex",
        dragging && "bg-primary/50",
      )}
    >
      <span
        aria-hidden="true"
        className="my-auto flex h-10 w-1 flex-col items-center justify-center gap-1 rounded-full bg-current opacity-30"
      >
        <span className="h-4 w-0.5 rounded-full bg-current" />
      </span>
    </div>
  );
}

function GeneratingView({ resumable, onResume }: { resumable?: boolean; onResume?: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10">
            <LoaderCircle size={22} className={cn("text-primary", !resumable && "animate-spin")} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {resumable ? COPY.flow.resumeTitle : COPY.flow.generatingTitle}
            </p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {resumable ? COPY.flow.resumeBody : COPY.flow.generatingBody}
            </p>
          </div>
        </div>
        {resumable ? (
          <Button className="mt-5 w-full" onClick={() => onResume?.()}>
            <Check size={15} /> {COPY.flow.resumeAction}
          </Button>
        ) : (
          <div className="mt-5 space-y-2">
            {[
              "Memvalidasi jawaban klarifikasi",
              "Memeriksa struktur dan section wajib template",
              "Menulis BRD lengkap dengan traceability",
            ].map((step) => (
              <div
                key={step}
                className="flex items-center gap-2.5 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              >
                <LoaderCircle size={13} className="animate-spin text-primary" />
                {step}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Workspace() {
  const { session } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const {
    flow,
    loading: flowLoading,
    refresh: refreshFlow,
    dismissPendingImport,
  } = useBrdFlow(activeId);
  const brdSelect = brdState.select;
  const brdRefresh = brdState.refresh;
  const refreshDocuments = useCallback(() => {
    if (!activeId) return;
    void queryClient.invalidateQueries({ queryKey: ["session", activeId, "documents"] });
  }, [activeId, queryClient]);
  const [phase, setPhase] = useState<Phase>("EMPTY_SESSION");
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [round, setRound] = useState(1);
  const [roundAnswers, setRoundAnswers] = useState<Record<string, string>>({});
  const [userStory, setUserStory] = useState("");
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [importing, setImporting] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(null);
  const [mobileView, setMobileView] = useState<"chat" | "brd">("chat");
  const [brdPaneVisible, setBrdPaneVisible] = useState(() => {
    try {
      return localStorage.getItem("sa.brdPaneVisible") !== "0";
    } catch {
      return true;
    }
  });
  const [brdShare, setBrdShare] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("sa.brdShare"));
      return Number.isFinite(saved) ? clampBrdShare(saved) : 0.5;
    } catch {
      return 0.5;
    }
  });
  const splitRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef(activeId);
  const pendingImportRef = useRef<string | null>(null);
  const history = useVersionHistory(brdState.active, (brd: BrdDocument) => {
    brdState.setActive(brd);
  });

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Reset state sesi saat pindah sesi supaya phase/pertanyaan tidak bocor.
  useEffect(() => {
    setQuestions([]);
    setRound(1);
    setRoundAnswers({});
    setUserStory("");
    setDraft("");
    setFlowError(null);
    setGenerationMode(null);
    setImporting(false);
    pendingImportRef.current = null;
  }, [activeId]);

  useEffect(() => {
    try {
      localStorage.setItem("sa.brdPaneVisible", brdPaneVisible ? "1" : "0");
    } catch {
      // ignore persistence errors
    }
  }, [brdPaneVisible]);

  useEffect(() => {
    try {
      localStorage.setItem("sa.brdShare", String(brdShare));
    } catch {
      // ignore persistence errors
    }
  }, [brdShare]);

  // Prioritas: BRD aktif > checkpoint flow (clarify/generate) > sesi kosong.
  useEffect(() => {
    if (generationMode === "local") return;
    if (brdState.active) {
      setPhase("BRD_ACTIVE");
      setDraft(brdState.active.contentMarkdown);
      setGenerationMode(null);
      return;
    }
    if (brdState.loading || flowLoading) return;
    if (flow?.phase === "CLARIFYING" && flow.questions.length) {
      setPhase("CLARIFYING");
      setQuestions(flow.questions);
      setRound(flow.round);
      setRoundAnswers(flow.answers);
      setUserStory((prev) => prev || (flow.userStory ?? ""));
      setGenerationMode(null);
      return;
    }
    if (flow?.phase) {
      // GENERATING, atau CLARIFYING tanpa pertanyaan (crash sebelum generate).
      setPhase("GENERATING");
      setUserStory((prev) => prev || (flow.userStory ?? ""));
      setRoundAnswers(flow.answers);
      setGenerationMode((prev) => (prev === "remote" ? "remote" : "resumable"));
      return;
    }
    setPhase("EMPTY_SESSION");
    setGenerationMode(null);
  }, [brdState.active, brdState.loading, flow, flowLoading, generationMode]);

  // Ikuti hasil generate yang sedang dipegang request/tab lain.
  useEffect(() => {
    if (phase !== "GENERATING" || !generationMode || !activeId) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      void refreshFlow();
      void brdRefresh();
      if (Date.now() - startedAt > GENERATION_POLL_TIMEOUT_MS) {
        window.clearInterval(timer);
        if (generationMode === "remote") {
          setFlowError(COPY.errors.generationTimeout);
          setGenerationMode("resumable");
        }
      }
    }, GENERATION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeId, brdRefresh, generationMode, phase, refreshFlow]);

  const pendingModification = brdState.active?.pendingContentMarkdown ?? null;
  useEffect(() => {
    if (pendingModification) setBrdPaneVisible(true);
  }, [pendingModification]);

  const pendingImport = flow?.pendingImportDocumentId
    ? (documentState.documents.find((item) => item.id === flow.pendingImportDocumentId) ?? null)
    : null;

  const applyBrd = useCallback(
    async (brd: BrdDocument, options: { notice: "generated" | "imported"; showPane?: boolean }) => {
      setQuestions([]);
      setRoundAnswers({});
      setGenerationMode(null);
      setPhase("BRD_ACTIVE");
      setBrdPaneVisible(options.showPane ?? true);
      setDraft(brd.contentMarkdown);
      await brdSelect(brd.id);
      notify.success(
        options.notice === "imported"
          ? COPY.notice.brdImported(brd.title)
          : COPY.notice.brdReady(brd.title),
      );
    },
    [brdSelect],
  );

  const runGeneration = useCallback(
    async (answers: Record<string, string>, force: boolean, story = userStory) => {
      if (!activeId) return;
      const sessionAtStart = activeId;
      setFlowError(null);
      setPhase("GENERATING");
      setGenerationMode("local");
      try {
        const result = await submitClarification(activeId, {
          userStory: story,
          answers,
          round,
          skip: force,
        });
        if (sessionAtStart !== activeIdRef.current) return;
        if (result.type === "clarification") {
          setQuestions(result.clarification_questions);
          setRound(result.round);
          setGenerationMode(null);
          setPhase("CLARIFYING");
          void refreshFlow();
          return;
        }
        if (result.type === "generating") {
          // Request/tab lain memegang lock; ikuti hasilnya lewat poll.
          setGenerationMode("remote");
          setPhase("GENERATING");
          void refreshFlow();
          return;
        }
        await applyBrd(result.brd, { notice: "generated" });
        void refreshFlow();
      } catch (caught) {
        if (sessionAtStart !== activeIdRef.current) return;
        setFlowError(messageOf(caught));
        setGenerationMode(null);
        void refreshFlow();
      }
    },
    [activeId, applyBrd, refreshFlow, round, userStory],
  );

  const generate = useCallback(
    async (story: string, file?: File) => {
      if (!activeId) return;
      const sessionAtStart = activeId;
      setFlowError(null);
      try {
        if (file) {
          const uploaded = await uploadDocument(activeId, file);
          refreshDocuments();
          // Give the reference a short window to be indexed before the first
          // questions are asked; generation still uses it later regardless.
          try {
            await waitForDocumentReady(activeId, uploaded.document.id, { timeoutMs: 60_000 });
          } catch {
            notify.info(
              "Referensi masih diproses. Pertanyaan awal mungkin belum memakainya, tetapi dokumen akan otomatis dipakai saat menyusun BRD.",
            );
          }
          if (sessionAtStart !== activeIdRef.current) return;
        }
        setUserStory(story);
        setRound(1);
        setRoundAnswers({});
        setQuestions([]);
        setPhase("GENERATING");
        setGenerationMode("local");
        const result = await clarifyBrd(activeId, { userStory: story, round: 1 });
        if (sessionAtStart !== activeIdRef.current) return;
        if (result.clarification_questions.length) {
          setQuestions(result.clarification_questions);
          setGenerationMode(null);
          setPhase("CLARIFYING");
          void refreshFlow();
        } else await runGeneration({}, true, story);
      } catch (caught) {
        if (sessionAtStart !== activeIdRef.current) return;
        setFlowError(messageOf(caught));
        notify.error(COPY.errors.generateStart(messageOf(caught)));
        setGenerationMode(null);
        setPhase("EMPTY_SESSION");
      }
    },
    [activeId, runGeneration, refreshDocuments, refreshFlow],
  );

  const submitAnswers = useCallback(
    async (answers: Record<string, string>) => {
      const merged = { ...roundAnswers, ...answers };
      setRoundAnswers(merged);
      await runGeneration(merged, false);
    },
    [roundAnswers, runGeneration],
  );

  const skipClarification = useCallback(() => {
    setQuestions([]);
    void runGeneration(roundAnswers, true);
  }, [roundAnswers, runGeneration]);

  const resumeGeneration = useCallback(() => {
    const story = userStory || flow?.userStory || "";
    setPhase("GENERATING");
    setGenerationMode("local");
    void runGeneration(roundAnswers, questions.length === 0, story);
  }, [flow?.userStory, questions.length, roundAnswers, runGeneration, userStory]);

  const importExisting = useCallback(
    async (file: File) => {
      if (!activeId) return;
      const sessionAtStart = activeId;
      setFlowError(null);
      setImporting(true);
      try {
        const uploaded = await uploadDocument(activeId, file, { brdImport: true });
        refreshDocuments();
        try {
          await waitForDocumentReady(activeId, uploaded.document.id);
        } catch {
          // Antrian tersimpan di server; hydrate effect akan melanjutkannya.
          notify.info(COPY.notice.importContinues);
          return;
        }
        if (sessionAtStart !== activeIdRef.current) return;
        const imported = await importPendingBrd(activeId);
        if (sessionAtStart !== activeIdRef.current) return;
        refreshDocuments();
        await applyBrd(imported.brd, { notice: "imported", showPane: false });
        void refreshFlow();
      } catch (caught) {
        if (sessionAtStart !== activeIdRef.current) return;
        const message = COPY.errors.importFailed(messageOf(caught));
        setFlowError(message);
        notify.error(message);
        void refreshFlow();
        // Tab lain mungkin menyelesaikan impor lebih dulu.
        void brdRefresh();
      } finally {
        setImporting(false);
      }
    },
    [activeId, applyBrd, brdRefresh, refreshDocuments, refreshFlow],
  );

  // Antrian impor yang selamat dari unmount: lanjutkan begitu dokumen siap.
  useEffect(() => {
    const documentId = flow?.pendingImportDocumentId;
    if (!documentId || !activeId || brdState.active || importing) return;
    if (pendingImportRef.current === documentId) return;
    const document = documentState.documents.find((item) => item.id === documentId);
    if (!document) {
      if (documentState.loaded && !documentState.fetching && !documentState.error) {
        pendingImportRef.current = documentId;
        void dismissPendingImport();
      }
      return;
    }
    if (document.status === "FAILED") return;
    if (document.status !== "READY" && document.status !== "PENDING_CONFIRMATION") return;

    pendingImportRef.current = documentId;
    const sessionAtStart = activeId;
    void (async () => {
      try {
        const imported = await importPendingBrd(activeId);
        if (sessionAtStart !== activeIdRef.current) return;
        refreshDocuments();
        await applyBrd(imported.brd, { notice: "imported", showPane: false });
      } catch {
        // Klaim gagal / dokumen belum siap: biarkan render berikutnya mencoba lagi.
        pendingImportRef.current = null;
      } finally {
        if (sessionAtStart === activeIdRef.current) void refreshFlow();
      }
    })();
  }, [
    activeId,
    applyBrd,
    brdState.active,
    dismissPendingImport,
    documentState.documents,
    documentState.error,
    documentState.fetching,
    documentState.loaded,
    flow?.pendingImportDocumentId,
    importing,
    refreshDocuments,
    refreshFlow,
  ]);

  const stepKey: StepKey =
    phase === "CLARIFYING" ? "clarify" : phase === "GENERATING" ? "generate" : "story";

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
      headerAction={
        <div className="flex items-center gap-2">
          {brdState.active && (
            <span className="hidden items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-medium text-success sm:inline-flex">
              <CheckCircle2 size={13} />
              {COPY.workspace.brdReady}
            </span>
          )}
          {(phase === "CLARIFYING" || phase === "GENERATING") && (
            <span className="hidden items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
              {phase === "CLARIFYING" ? COPY.workspace.clarifying : COPY.workspace.generating}
            </span>
          )}
          <SettingsDialog />
        </div>
      }
    >
      {(error || brdState.error || flowError || history.error) && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4">
          <Alert variant="destructive">
            {[error, brdState.error, flowError, history.error].filter(Boolean).join(" ")}
          </Alert>
        </div>
      )}
      {!brdState.active && pendingImport?.status === "FAILED" && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4">
          <Alert
            variant="destructive"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span>{COPY.errors.importPendingFailed(pendingImport.title)}</span>
            <Button size="sm" variant="outline" onClick={() => void dismissPendingImport()}>
              {COPY.workspace.dismissImport}
            </Button>
          </Alert>
        </div>
      )}
      {!brdState.active && pendingImport && pendingImport.status !== "FAILED" && (
        <div className="mx-auto mt-4 w-full max-w-3xl px-4 text-xs text-muted-foreground">
          {COPY.notice.importWaiting}
        </div>
      )}
      {!activeId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {loading ? COPY.workspace.loading : COPY.workspace.noSession}
        </div>
      ) : brdState.active ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="hidden shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-3 py-1 lg:flex">
            <span className="truncate text-xs font-medium text-muted-foreground">
              {brdState.active.title}
            </span>
            <button
              type="button"
              onClick={() => setBrdPaneVisible((visible) => !visible)}
              aria-pressed={brdPaneVisible}
              aria-label={brdPaneVisible ? COPY.workspace.hideBrd : COPY.workspace.showBrd}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {brdPaneVisible ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              {brdPaneVisible ? COPY.workspace.hideBrd : COPY.workspace.showBrd}
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 border-b border-border/70 bg-muted/40 px-3 py-1.5 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileView("chat")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                mobileView === "chat"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {COPY.workspace.chatView}
            </button>
            <button
              type="button"
              onClick={() => setMobileView("brd")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                mobileView === "brd"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {COPY.workspace.brdView}
            </button>
          </div>

          <div ref={splitRef} className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div
              className={cn(
                "min-h-0 flex-1 flex-col lg:flex",
                mobileView === "chat" ? "flex" : "hidden",
              )}
            >
              <AnviaChat
                key={activeId}
                sessionId={activeId}
                brdDocumentId={brdState.active.id}
                initialMessages={initialMessages}
                onRunEnded={() => {
                  void refreshAfterRun();
                  void brdState.refresh();
                }}
                onStatusChange={(status) => setStreaming(isStreaming(status))}
              />
            </div>

            {brdPaneVisible && (
              <SplitResizer containerRef={splitRef} share={brdShare} onResize={setBrdShare} />
            )}

            <div
              className={cn(
                "min-h-0 flex-1 flex-col border-t lg:flex-none lg:border-l lg:border-t-0 lg:w-[var(--brd-share)]",
                mobileView === "brd" ? "flex" : "hidden",
                brdPaneVisible ? "lg:flex" : "lg:hidden",
              )}
              style={{ "--brd-share": `${brdShare * 100}%` } as React.CSSProperties}
            >
              <DocumentPane
                brd={brdState.active}
                content={draft}
                diff={history.diff}
                onDiff={(from, to) => void history.showDiff(from, to)}
                onRestore={(version) => void history.restore(version)}
                onClearDiff={history.clearDiff}
                onApproved={(next) => {
                  brdState.setActive(next);
                  setDraft(next.contentMarkdown);
                }}
                busy={history.busy}
              />
            </div>
          </div>
        </div>
      ) : brdState.loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading conversation…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <FlowSteps current={stepKey} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {phase === "CLARIFYING" ? (
              <FeedbackForm
                key={`round-${round}`}
                questions={questions}
                round={round}
                initialAnswers={roundAnswers}
                onSubmit={submitAnswers}
                onSkip={skipClarification}
              />
            ) : phase === "GENERATING" ? (
              <GeneratingView
                resumable={generationMode === "resumable"}
                onResume={generationMode === "resumable" ? resumeGeneration : undefined}
              />
            ) : (
              <NewBrdPanel
                onGenerate={(story, file) => void generate(story, file)}
                onImport={(file) => void importExisting(file)}
                busy={streaming}
                importing={importing}
              />
            )}
          </div>
        </div>
      )}
    </ChatShell>
  );
}
