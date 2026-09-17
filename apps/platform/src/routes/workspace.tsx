import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Paperclip, Sliders } from "lucide-react";
import type { UseChatStatus } from "@anvia/react";
import { Badge } from "#/components/base/badge";
import { Alert } from "#/components/base/alert";
import { Button } from "#/components/base/button";
import { AnviaChat, type MentionRequest } from "#/modules/chat/anvia-chat";
import { ChatShell } from "#/modules/chat/chat-shell";
import { SessionSidebar, type ActiveSessionBadge } from "#/modules/chat/session-sidebar";
import { SettingsModal, type SettingsTab } from "#/modules/settings/settings-page";
import { useCurrentTemplate } from "#/modules/settings/hooks/use-current-template";
import { useSessions } from "#/modules/chat/hooks/use-sessions";
import { useDocuments } from "#/modules/chat/hooks/use-documents";
import { useBrds } from "#/modules/brd/hooks/use-brds";
import { useBrdFlow } from "#/modules/brd/hooks/use-brd-flow";
import { useVersionHistory } from "#/modules/brd/hooks/use-version-history";
import { NewBrdPanel, type NewBrdMode } from "#/modules/brd/new-brd-panel";
import { FeedbackForm, type ClarificationQuestion } from "#/modules/brd/feedback-form";
import { GeneratingView, type GenerationStage } from "#/modules/brd/generating-view";
import { DocumentPane, type DocumentTab } from "#/modules/brd/document-pane";
import { DocumentsModal } from "#/modules/brd/documents-modal";
import {
  DEMO_USER_ID,
  clarifyBrd,
  importPendingBrd,
  submitClarification,
  uploadDocument,
  type BrdDocument,
  type DocumentSummary,
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

function initialsOf(value: string): string {
  const parts = value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .slice(0, 2);
  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "SA";
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
  const { template, hasTemplate } = useCurrentTemplate();

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
  const [generationStage, setGenerationStage] = useState<GenerationStage>("clarify");
  const [pendingClarifyStory, setPendingClarifyStory] = useState<string | null>(null);
  const [brdTab, setBrdTab] = useState<DocumentTab>("preview");
  const [newBrdMode, setNewBrdMode] = useState<NewBrdMode>("story");
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("theme");
  const [mentionRequest, setMentionRequest] = useState<MentionRequest | null>(null);

  const activeIdRef = useRef(activeId);
  const pendingImportRef = useRef<string | null>(null);
  const clarifyResumeRef = useRef<string | null>(null);

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
    setGenerationStage("clarify");
    setImporting(false);
    setPendingClarifyStory(null);
    setBrdTab("preview");
    setNewBrdMode("story");
    pendingImportRef.current = null;
    clarifyResumeRef.current = null;
  }, [activeId]);

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
    if (flow?.phase === "CLARIFYING") {
      setUserStory((prev) => prev || (flow.userStory ?? ""));
      setRoundAnswers(flow.answers);
      if (flow.questions.length) {
        setPhase("CLARIFYING");
        setQuestions(flow.questions);
        setRound(flow.round);
        setGenerationMode(null);
        clarifyResumeRef.current = null;
        return;
      }
      // Klarifikasi terputus sebelum pertanyaan tersimpan: lanjutkan otomatis
      // melihat status tersimpan di database.
      if (flow.userStory && clarifyResumeRef.current !== flow.userStory) {
        setPendingClarifyStory(flow.userStory);
      }
      return;
    }
    if (flow?.phase) {
      // GENERATING: ikuti hasilnya lewat poll/lanjutkan.
      setPhase("GENERATING");
      setGenerationStage("generate");
      setUserStory((prev) => prev || (flow.userStory ?? ""));
      setRoundAnswers(flow.answers);
      setGenerationMode((prev) => (prev === "remote" ? "remote" : "resumable"));
      return;
    }
    setPhase("EMPTY_SESSION");
    setGenerationMode(null);
  }, [brdState.active, brdState.loading, flow, flowLoading, generationMode]);

  // Ikuti hasil generate yang sedang dipegang request/tab lain. Poll hanya
  // untuk mode "remote"; saat request lokal kita sendiri sedang berjalan,
  // mem-poll /flow & /brd hanya menambah trafik dan memicu perlombaan state.
  useEffect(() => {
    if (phase !== "GENERATING" || generationMode !== "remote" || !activeId) return;
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

  const pendingImport = flow?.pendingImportDocumentId
    ? (documentState.documents.find((item) => item.id === flow.pendingImportDocumentId) ?? null)
    : null;

  const applyBrd = useCallback(
    async (brd: BrdDocument, options: { notice: "generated" | "imported"; showPane?: boolean }) => {
      setQuestions([]);
      setRoundAnswers({});
      setGenerationMode(null);
      setPhase("BRD_ACTIVE");
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
      setGenerationStage("generate");
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
            notify.info(COPY.notice.referenceStillIndexing);
          }
          if (sessionAtStart !== activeIdRef.current) return;
        }
        setUserStory(story);
        setRound(1);
        setRoundAnswers({});
        setQuestions([]);
        setPhase("GENERATING");
        setGenerationMode("local");
        setGenerationStage("clarify");
        // Tandai story ini sedang kami klarifikasi sendiri supaya checkpoint
        // CLARIFYING sementara (tanpa pertanyaan) dari poll tidak memicu
        // /clarify kedua.
        clarifyResumeRef.current = story;
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
        // Tandai story sudah dicoba supaya hydrate effect tidak otomatis
        // me-retry /clarify yang gagal dalam loop.
        clarifyResumeRef.current = story;
        setFlowError(messageOf(caught));
        notify.error(COPY.errors.generateStart(messageOf(caught)));
        setGenerationMode(null);
        setPhase("EMPTY_SESSION");
      }
    },
    [activeId, runGeneration, refreshDocuments, refreshFlow],
  );

  // Lanjutkan klarifikasi yang terputus begitu flow-nya selesai dimuat.
  useEffect(() => {
    if (!pendingClarifyStory) return;
    clarifyResumeRef.current = pendingClarifyStory;
    setPendingClarifyStory(null);
    void generate(pendingClarifyStory);
  }, [generate, pendingClarifyStory]);

  const submitAnswers = useCallback(
    async (answers: Record<string, string>) => {
      const merged = { ...roundAnswers, ...answers };
      setRoundAnswers(merged);
      await runGeneration(merged, false);
    },
    [roundAnswers, runGeneration],
  );

  const resumeGeneration = useCallback(() => {
    const story = userStory || flow?.userStory || "";
    setPhase("GENERATING");
    setGenerationMode("local");
    setGenerationStage("generate");
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

  const activeSession = sessions.find((item) => item.id === activeId) ?? null;
  const activeBadge: ActiveSessionBadge | null = brdState.active
    ? { label: `v${brdState.active.currentVersion}.0`, tone: "emerald" }
    : phase === "CLARIFYING"
      ? { label: `R${round}`, tone: "sky" }
      : phase === "GENERATING"
        ? { label: "Menyusun", tone: "amber" }
        : { label: "Draft", tone: "neutral" };

  const openSettings = useCallback((tab: SettingsTab = "theme") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const mentionDocument = useCallback((document: DocumentSummary) => {
    setMentionRequest({ id: Date.now(), name: document.title });
    setDocumentsOpen(false);
  }, []);

  const templateLabel = template?.title ?? null;

  return (
    <ChatShell
      title={
        activeSession && (
          <>
            <span className="max-w-[200px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">
              {activeSession.title}
            </span>
            <Badge tone={activeBadge?.tone ?? "neutral"}>{activeBadge?.label}</Badge>
          </>
        )
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => openSettings("template")}
            title="Pengaturan template struktur BRD"
            className="hidden cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200 md:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Layers size={12} className="text-slate-500" />
            <span className="max-w-28 truncate text-[11px]">
              {templateLabel ?? COPY.sidebar.noTemplate}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDocumentsOpen(true)}
            title="Dokumen lampiran sesi"
            className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Paperclip size={12} className="text-slate-500" />
            <span className="hidden text-[11px] sm:inline">Lampiran</span>
            <span className="rounded bg-slate-200 px-1 py-px font-mono text-[10px] text-slate-700 dark:bg-slate-700 dark:text-slate-200">
              {documentState.documents.length}
            </span>
          </button>

          <Button variant="outline" size="sm" onClick={() => openSettings()}>
            <Sliders size={12} className="text-slate-500" />
            <span className="hidden text-[11px] sm:inline">Pengaturan</span>
          </Button>

          <span
            title={DEMO_USER_ID}
            className="ms-1 grid size-6 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-800 text-[10px] font-semibold text-white dark:border-slate-700"
          >
            {initialsOf(DEMO_USER_ID)}
          </span>
        </>
      }
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
          templateName={templateLabel}
          activeBadge={activeBadge}
          onOpenSettings={openSettings}
        />
      }
    >
      {(error || brdState.error || flowError || history.error) && (
        <div className="mx-auto mt-3 w-full max-w-3xl px-4">
          <Alert>
            {[error, brdState.error, flowError, history.error].filter(Boolean).join(" ")}
          </Alert>
        </div>
      )}
      {!brdState.active && pendingImport?.status === "FAILED" && (
        <div className="mx-auto mt-3 w-full max-w-3xl px-4">
          <Alert tone="warning" className="flex flex-wrap items-center justify-between gap-3">
            <span>{COPY.errors.importPendingFailed(pendingImport.title)}</span>
            <Button size="sm" variant="outline" onClick={() => void dismissPendingImport()}>
              {COPY.workspace.dismissImport}
            </Button>
          </Alert>
        </div>
      )}
      {!brdState.active && pendingImport && pendingImport.status !== "FAILED" && (
        <div className="mx-auto mt-3 w-full max-w-3xl px-4">
          <Alert tone="info">{COPY.notice.importWaiting}</Alert>
        </div>
      )}

      {!activeId ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          {loading ? COPY.workspace.loading : COPY.workspace.noSession}
        </div>
      ) : brdState.active ? (
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="h-1/2 w-full shrink-0 border-b border-slate-200 md:h-full md:w-[360px] md:border-r md:border-b-0 lg:w-[400px] dark:border-slate-800">
            <AnviaChat
              key={activeId}
              sessionId={activeId}
              brdDocumentId={brdState.active.id}
              initialMessages={initialMessages}
              documentsCount={documentState.documents.length}
              onOpenDocuments={() => setDocumentsOpen(true)}
              mentionRequest={mentionRequest}
              onMentionConsumed={() => setMentionRequest(null)}
              pendingProposal={
                brdState.active.pendingContentMarkdown
                  ? {
                      from: brdState.active.currentVersion,
                      to: brdState.active.currentVersion + 1,
                      summary: brdState.active.pendingChangeSummary,
                    }
                  : null
              }
              onReviewDiff={() => setBrdTab("diff")}
              onRunEnded={() => {
                void refreshAfterRun();
                void brdState.refresh();
              }}
              onStatusChange={(status) => setStreaming(isStreaming(status))}
            />
          </div>

          <div className="min-h-0 h-1/2 flex-1 md:h-full">
            <DocumentPane
              brd={brdState.active}
              content={draft}
              diff={history.diff}
              tab={brdTab}
              onTabChange={setBrdTab}
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
      ) : brdState.loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          {COPY.workspace.loadingConversation}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {phase === "CLARIFYING" ? (
            <FeedbackForm
              key={`round-${round}`}
              questions={questions}
              round={round}
              initialAnswers={roundAnswers}
              onSubmit={submitAnswers}
            />
          ) : phase === "GENERATING" ? (
            <GeneratingView
              templateName={templateLabel}
              stage={generationStage}
              resumable={generationMode === "resumable"}
              onResume={generationMode === "resumable" ? resumeGeneration : undefined}
            />
          ) : (
            <NewBrdPanel
              onGenerate={(story, file) => void generate(story, file)}
              onImport={(file) => void importExisting(file)}
              busy={streaming}
              importing={importing}
              templateName={templateLabel}
              templateReady={hasTemplate}
              onOpenTemplateManager={() => openSettings("template")}
              onModeChange={setNewBrdMode}
              initialStory={userStory}
            />
          )}
        </div>
      )}

      {!hasTemplate &&
        !brdState.active &&
        phase === "EMPTY_SESSION" &&
        newBrdMode === "story" &&
        !importing &&
        !pendingImport && (
          <button
            type="button"
            onClick={() => openSettings("template")}
            className="fixed right-4 bottom-4 z-40 inline-flex max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-lg transition-colors hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
          >
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
            <Layers size={13} className="shrink-0" />
            {COPY.newBrd.templateBadge}
          </button>
        )}

      <DocumentsModal
        open={documentsOpen}
        onClose={() => setDocumentsOpen(false)}
        documents={documentState.documents}
        loading={documentState.loading}
        uploading={documentState.uploading}
        error={documentState.error}
        onUpload={(files) => void documentState.upload(files)}
        onDelete={(id) => void documentState.remove(id)}
        onMention={mentionDocument}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
      />
    </ChatShell>
  );
}
