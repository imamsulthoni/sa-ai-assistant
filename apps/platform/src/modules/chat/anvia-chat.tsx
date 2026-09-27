import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createHttpClientTransport } from "@anvia/client";
import { useChat, type UseChatStatus } from "@anvia/react";
import {
  ChatProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useComposer,
} from "@anvia/react-ui";
import {
  AtSign,
  Bot,
  FileText,
  LoaderCircle,
  Paperclip,
  Send,
  SplitSquareVertical,
  Square,
  X,
} from "lucide-react";
import type { UIMessage } from "@anvia/client";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from "#/lib/api";
import { getStoredToken } from "#/lib/auth-storage";
import { COPY } from "#/lib/copy";
import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  ATTACHMENT_MAX_UPLOAD_LABEL,
} from "#/lib/upload";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
import {
  ComposerAttachment,
  MessageBubble,
} from "#/modules/chat/message-bubble";
import { MentionPopover } from "#/modules/brd/mention-popover";

export type MentionRequest = { id: number; name: string; documentId: string };

export type PendingProposal = {
  from: number;
  to: number;
  summary?: string | null;
};

type AnviaChatProps = {
  sessionId: string;
  projectId: string;
  brdDocumentId?: string;
  initialMessages: UIMessage[];
  onRunEnded?: () => void;
  onStatusChange?: (status: UseChatStatus) => void;
  onOpenDocuments?: () => void;
  documentsCount?: number;
  mentionRequest?: MentionRequest | null;
  onMentionConsumed?: () => void;
  pendingProposal?: PendingProposal | null;
  onReviewDiff?: () => void;
};

type SessionUpload = {
  key: string;
  name: string;
  isImage: boolean;
  previewUrl?: string;
  status: "uploading" | "ready";
  documentId?: string;
};

type MentionItem = {
  id: string;
  name: string;
};

type StoredComposerItem = { documentId: string; name: string };

const COMPOSER_CONTEXT_PREFIX = "sa.composerContext.";

function composerStorageKey(sessionId: string): string {
  return `${COMPOSER_CONTEXT_PREFIX}${sessionId}`;
}

function readStoredComposerContext(sessionId: string): SessionUpload[] {
  try {
    const raw = sessionStorage.getItem(composerStorageKey(sessionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item): SessionUpload[] => {
      if (!item || typeof item !== "object") return [];
      const { documentId, name } = item as Partial<StoredComposerItem>;
      if (typeof documentId !== "string" || typeof name !== "string") return [];
      return [
        {
          key: `stored-${documentId}`,
          name,
          isImage: false,
          status: "ready",
          documentId,
        },
      ];
    });
  } catch {
    return [];
  }
}

function writeStoredComposerContext(
  sessionId: string,
  uploads: SessionUpload[],
): void {
  try {
    const items: StoredComposerItem[] = uploads
      .filter((item) => item.status === "ready" && item.documentId)
      .map((item) => ({
        documentId: item.documentId as string,
        name: item.name,
      }));
    if (items.length)
      sessionStorage.setItem(
        composerStorageKey(sessionId),
        JSON.stringify(items),
      );
    else sessionStorage.removeItem(composerStorageKey(sessionId));
  } catch {
    // Storage can be unavailable (private mode); chips then live in memory only.
  }
}

export function AnviaChat({
  sessionId,
  projectId,
  brdDocumentId,
  initialMessages,
  onRunEnded,
  onStatusChange,
  onOpenDocuments,
  documentsCount = 0,
  mentionRequest,
  onMentionConsumed,
  pendingProposal,
  onReviewDiff,
}: AnviaChatProps) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<SessionUpload[]>(() =>
    readStoredComposerContext(sessionId),
  );
  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const contextFilesRef = useRef<MentionItem[]>([]);

  useEffect(() => {
    contextFilesRef.current = [
      ...uploads
        .filter((item) => item.status === "ready" && item.documentId)
        .map((item) => ({ id: item.documentId as string, name: item.name })),
      ...mentions,
    ];
  }, [uploads, mentions]);

  useEffect(() => {
    writeStoredComposerContext(sessionId, uploads);
  }, [sessionId, uploads]);

  // Dokumen yang dihapus dari sidebar juga membersihkan chip yang menunjuknya.
  const sessionDocumentsQuery = useQuery({
    queryKey: ["session", sessionId, "documents"],
    queryFn: () =>
      listDocuments(sessionId).then((response) => response.documents),
  });

  const sessionDocuments = sessionDocumentsQuery.data;

  useEffect(() => {
    if (!sessionDocumentsQuery.isSuccess || !sessionDocuments) return;
    const ids = new Set(sessionDocuments.map((document) => document.id));
    setUploads((prev) => {
      const next = prev.filter(
        (item) =>
          item.status !== "ready" ||
          (item.documentId && ids.has(item.documentId)),
      );
      return next.length === prev.length ? prev : next;
    });
  }, [sessionDocuments, sessionDocumentsQuery.isSuccess]);

  const clearComposerContext = useCallback(() => {
    setMentions([]);
    setUploads((prev) => {
      for (const item of prev) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return [];
    });
  }, []);

  const refreshSessionDocuments = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ["session", sessionId, "documents"],
    });
  }, [queryClient, sessionId]);

  const attachFiles = useCallback(
    async (files: FileList) => {
      setUploadError(null);
      for (const file of Array.from(files)) {
        if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) {
          const message = COPY.errors.attachmentTooLarge(
            file.name,
            ATTACHMENT_MAX_UPLOAD_LABEL,
          );
          setUploadError(message);
          notify.error(message);
          continue;
        }
        const key = crypto.randomUUID();
        const isImage = file.type.startsWith("image/");
        const previewUrl = isImage ? URL.createObjectURL(file) : undefined;
        setUploads((prev) => [
          ...prev,
          { key, name: file.name, isImage, previewUrl, status: "uploading" },
        ]);
        try {
          const response = await uploadDocument(sessionId, file);
          setUploads((prev) =>
            prev.map((item) =>
              item.key === key
                ? { ...item, status: "ready", documentId: response.document.id }
                : item,
            ),
          );
          refreshSessionDocuments();
          notify.success(`${file.name} siap dijadikan konteks.`);
        } catch (caught) {
          setUploads((prev) => prev.filter((item) => item.key !== key));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          const message = describeError(caught);
          setUploadError(message);
          notify.error(message);
        }
      }
    },
    [refreshSessionDocuments, sessionId],
  );

  const removeUpload = useCallback(
    async (item: SessionUpload) => {
      if (item.status !== "ready") return;
      setUploadError(null);
      setUploads((prev) => prev.filter((entry) => entry.key !== item.key));
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (!item.documentId) return;
      try {
        await deleteDocument(sessionId, item.documentId);
        refreshSessionDocuments();
        notify.info(`${item.name} dihapus dari sesi.`);
      } catch (caught) {
        const message = describeError(caught);
        setUploadError(message);
        notify.error(message);
      }
    },
    [refreshSessionDocuments, sessionId],
  );

  const transport = useMemo(
    () => {
      const token = getStoredToken();
      const headers: Record<string, string> = {
        "x-conversation-id": sessionId,
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      return createHttpClientTransport({
        endpoint: `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/chat`,
        headers,
        body: (context) => {
          const files = contextFilesRef.current;
          const attachedFiles = files.map((item) => item.name);
          const attachedDocumentIds = files.map((item) => item.id);
          const requestMetadata =
            (context.request as { metadata?: Record<string, unknown> })
              .metadata ?? {};
          const metadata = {
            ...requestMetadata,
            ...(brdDocumentId ? { phase: "QA", brdDocumentId } : {}),
            ...(attachedFiles.length
              ? { attachedFiles, attachedDocumentIds }
              : {}),
          };
          // The request now carries the context; the composer queue starts fresh.
          if (files.length) clearComposerContext();
          return JSON.stringify({
            ...context.request,
            metadata: Object.keys(metadata).length ? metadata : undefined,
          });
        },
      });
    },
    [brdDocumentId, clearComposerContext, sessionId],
  );

  const chat = useChat({
    transport,
    initialMessages,
    onEvent: (event) => {
      if (event.type === "run_end" || event.type === "error") {
        clearComposerContext();
        onRunEnded?.();
      }
    },
  });

  useEffect(() => {
    onStatusChange?.(chat.status);
  }, [chat.status, onStatusChange]);

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const brdActive = Boolean(brdDocumentId);

  const addMention = useCallback((item: MentionItem) => {
    setMentions((prev) =>
      prev.some((entry) => entry.id === item.id) ? prev : [...prev, item],
    );
  }, []);
  const removeMention = useCallback((id: string) => {
    setMentions((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    const input = document.querySelector<HTMLTextAreaElement>(
      `[data-chat-composer="${sessionId}"] textarea`,
    );
    if (!input) return;
    const handleInput = () => {
      const match = input.value.match(/(?:^|\s)@([^\s@]*)$/);
      if (!match) {
        setMentionOpen(false);
        setMentionQuery("");
        return;
      }
      setMentionQuery(match[1]);
      setMentionOpen(true);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMentionOpen(false);
        setMentionQuery("");
      }
    };
    input.addEventListener("input", handleInput);
    input.addEventListener("keydown", handleKeyDown);
    return () => {
      input.removeEventListener("input", handleInput);
      input.removeEventListener("keydown", handleKeyDown);
    };
  }, [sessionId]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <ChatProvider controller={chat}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded bg-foreground text-background shadow-xs">
                <Bot size={14} />
              </span>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-semibold text-foreground">
                  AI Assistant
                </h3>
                <span className="size-1.5 rounded-full bg-success" />
              </div>
            </div>
            {onOpenDocuments && (
              <button
                type="button"
                onClick={onOpenDocuments}
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors"
              >
                <Paperclip size={11} className="text-muted-foreground" />
                <span>{COPY.chat.documentsCount(documentsCount)}</span>
              </button>
            )}
          </div>

          <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3 px-3 py-4">
              <ThreadPrimitive.Empty>
                <div className="py-10 text-center">
                  {brdActive ? (
                    <>
                      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-2xl bg-success/10 text-success">
                        <FileText size={18} />
                      </div>
                      <h1 className="text-sm font-bold text-foreground">
                        {COPY.chat.brdReadyTitle}
                      </h1>
                      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                        {COPY.chat.brdReadyBody}
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-sm font-bold text-foreground">
                        {COPY.chat.emptyTitle}
                      </h1>
                      <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                        {COPY.chat.emptyBody}
                      </p>
                    </>
                  )}
                </div>
              </ThreadPrimitive.Empty>

              <ThreadPrimitive.Messages>
                {() => <MessageBubble />}
              </ThreadPrimitive.Messages>

              <StreamingIndicator />

              {pendingProposal && (
                <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-warning/10 px-1.5 py-px text-[10px] font-semibold text-warning">
                      {COPY.chat.pendingProposal}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      v{pendingProposal.from}.0 → v{pendingProposal.to}.0
                    </span>
                  </div>
                  {pendingProposal.summary && (
                    <p className="text-[11px] leading-relaxed text-foreground">
                      {pendingProposal.summary}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onReviewDiff?.()}
                    className="mt-0.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground shadow-xs transition-colors hover:bg-warning/90"
                  >
                    <SplitSquareVertical size={12} />
                    <span>{COPY.chat.reviewDiff}</span>
                  </button>
                </div>
              )}
            </div>
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root
            data-chat-composer={sessionId}
            className="shrink-0 border-t border-border bg-card px-2.5 py-2.5"
          >
            <ComposerPrimitive.Attachments className="mb-2 flex flex-wrap items-center gap-2">
              {(attachment) => <ComposerAttachment key={attachment.id} />}
            </ComposerPrimitive.Attachments>

            {uploads.length > 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {uploads.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-1.5 rounded border border-border bg-muted px-2 py-1 text-[11px] text-foreground"
                  >
                    {item.isImage && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="size-6 rounded object-cover"
                      />
                    ) : (
                      <FileText size={12} className="shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className="max-w-32 truncate font-mono"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    {item.status === "uploading" ? (
                      <LoaderCircle
                        size={11}
                        className="animate-spin text-muted-foreground"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void removeUpload(item)}
                        aria-label={`Hapus ${item.name}`}
                        className="grid size-4 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {mentions.length > 0 && (
              <MentionChips mentions={mentions} onRemove={removeMention} />
            )}

            {uploadError && (
              <p className="mb-2 text-xs text-destructive">{uploadError}</p>
            )}

            <div className="relative">
              {mentionOpen && (
                <MentionDock
                  projectId={projectId}
                  query={mentionQuery}
                  onPicked={addMention}
                  onClose={() => setMentionOpen(false)}
                />
              )}

              <div className="flex items-end gap-1.5 rounded-lg border border-input bg-muted p-1 transition-all focus-within:ring-1 focus-within:ring-ring">
                <label
                  className="grid size-7 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
                  title={COPY.chat.attachTitle(ATTACHMENT_MAX_UPLOAD_LABEL)}
                >
                  <Paperclip size={15} />
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    accept=".pdf,.md,.markdown,.docx,.png,.jpg,.jpeg,.webp,.tiff"
                    onChange={(event) => {
                      if (event.currentTarget.files?.length) {
                        void attachFiles(event.currentTarget.files);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                </label>

                <button
                  type="button"
                  aria-label={COPY.chat.mentionTitle}
                  title={COPY.chat.mentionTitle}
                  onClick={() => setMentionOpen((open) => !open)}
                  className={`grid size-7 shrink-0 cursor-pointer place-items-center rounded transition-colors ${
                    mentionOpen
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AtSign size={15} />
                </button>

                <ComposerPrimitive.TextareaInput
                  className="max-h-40 min-h-8 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground"
                  placeholder={
                    brdActive
                      ? COPY.chat.composerPlaceholderBrd
                      : COPY.chat.composerPlaceholder
                  }
                />

                <ComposerSubmitArea />
              </div>
            </div>

            <MentionInjector
              request={mentionRequest ?? null}
              onConsumed={onMentionConsumed}
              onMention={addMention}
            />
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </ChatProvider>
    </div>
  );
}

function MentionInjector({
  request,
  onConsumed,
  onMention,
}: {
  request: MentionRequest | null;
  onConsumed?: () => void;
  onMention?: (item: MentionItem) => void;
}) {
  const composer = useComposer();
  const composerRef = useRef(composer);
  composerRef.current = composer;
  const consumedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!request || consumedRef.current === request.id) return;
    consumedRef.current = request.id;
    const current = composerRef.current.input;
    composerRef.current.setInput(
      current ? `${current.trimEnd()} @${request.name} ` : `@${request.name} `,
    );
    // Daftarkan ID dokumen supaya terkirim sebagai attachedDocumentIds dan
    // agent menerima blok konteks isi file, bukan sekadar teks @nama.
    onMention?.({ id: request.documentId, name: request.name });
    onConsumed?.();
  }, [request, onConsumed, onMention]);

  return null;
}

function MentionChips({
  mentions,
  onRemove,
}: {
  mentions: MentionItem[];
  onRemove: (id: string) => void;
}) {
  const composer = useComposer();
  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5">
      <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        <AtSign size={10} /> Konteks:
      </span>
      {mentions.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-foreground"
        >
          <span className="max-w-32 truncate" title={item.name}>
            {item.name}
          </span>
          <button
            type="button"
            aria-label={`Hapus mention ${item.name}`}
            onClick={() => {
              composer.setInput(
                composer.input
                  .split(`@${item.name}`)
                  .join("")
                  .replace(/ {2,}/g, " ")
                  .trimStart(),
              );
              onRemove(item.id);
            }}
            className="cursor-pointer text-muted-foreground transition-colors hover:text-destructive"
          >
            <X size={10} />
          </button>
        </span>
      ))}
    </div>
  );
}

function MentionDock({
  projectId,
  query,
  onPicked,
  onClose,
}: {
  projectId: string;
  query: string;
  onPicked: (item: MentionItem) => void;
  onClose: () => void;
}) {
  const composer = useComposer();

  return (
    <MentionPopover
      projectId={projectId}
      query={query}
      onClose={onClose}
      onPick={(result) => {
        const mention = `@${result.title} `;
        const current = composer.input;
        const next = /@([^\s@]*)$/.test(current)
          ? current.replace(/@([^\s@]*)$/, mention)
          : `${current}${current && !current.endsWith(" ") ? " " : ""}${mention}`;
        composer.setInput(next);
        onPicked({ id: result.id, name: result.title });
        onClose();
      }}
    />
  );
}

function ComposerSubmitArea() {
  const composer = useComposer();
  const canStop = composer.canStop;

  if (canStop) {
    return (
      <ComposerPrimitive.Stop className="grid size-8 shrink-0 cursor-pointer place-items-center rounded bg-foreground text-background transition-opacity hover:opacity-90">
        <Square size={13} fill="currentColor" />
      </ComposerPrimitive.Stop>
    );
  }

  return (
    <ComposerPrimitive.Submit className="grid size-8 shrink-0 cursor-pointer place-items-center rounded bg-foreground text-background transition-opacity hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-40">
      <Send size={14} />
    </ComposerPrimitive.Submit>
  );
}

function StreamingIndicator() {
  return (
    <ThreadPrimitive.Loading
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
    >
      <LoaderCircle size={13} className="animate-spin" />
      {COPY.chat.agentWorking}
    </ThreadPrimitive.Loading>
  );
}
