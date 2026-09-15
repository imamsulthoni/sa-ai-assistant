import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createHttpClientTransport } from "@anvia/client";
import { useChat, type UseChatStatus } from "@anvia/react";
import { ChatProvider, ComposerPrimitive, ThreadPrimitive, useComposer } from "@anvia/react-ui";
import { AtSign, FileText, LoaderCircle, Paperclip, Send, Square, X } from "lucide-react";
import type { UIMessage } from "@anvia/client";
import { DEMO_USER_ID, deleteDocument, listDocuments, uploadDocument } from "#/lib/api";
import { COPY } from "#/lib/copy";
import { describeError } from "#/lib/errors";
import { notify } from "#/lib/notify";
import { ComposerAttachment, MessageBubble } from "#/modules/chat/message-bubble";
import { MentionPopover } from "#/modules/brd/mention-popover";

type AnviaChatProps = {
  sessionId: string;
  brdDocumentId?: string;
  initialMessages: UIMessage[];
  onRunEnded?: () => void;
  onStatusChange?: (status: UseChatStatus) => void;
};

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

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
      return [{ key: `stored-${documentId}`, name, isImage: false, status: "ready", documentId }];
    });
  } catch {
    return [];
  }
}

function writeStoredComposerContext(sessionId: string, uploads: SessionUpload[]): void {
  try {
    const items: StoredComposerItem[] = uploads
      .filter((item) => item.status === "ready" && item.documentId)
      .map((item) => ({ documentId: item.documentId as string, name: item.name }));
    if (items.length) sessionStorage.setItem(composerStorageKey(sessionId), JSON.stringify(items));
    else sessionStorage.removeItem(composerStorageKey(sessionId));
  } catch {
    // Storage can be unavailable (private mode); chips then live in memory only.
  }
}

export function AnviaChat({
  sessionId,
  brdDocumentId,
  initialMessages,
  onRunEnded,
  onStatusChange,
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
    queryFn: () => listDocuments(sessionId).then((response) => response.documents),
  });
  const sessionDocuments = sessionDocumentsQuery.data;
  useEffect(() => {
    if (!sessionDocumentsQuery.isSuccess || !sessionDocuments) return;
    const ids = new Set(sessionDocuments.map((document) => document.id));
    setUploads((prev) => {
      const next = prev.filter(
        (item) => item.status !== "ready" || (item.documentId && ids.has(item.documentId)),
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
    void queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
  }, [queryClient, sessionId]);

  const attachFiles = useCallback(
    async (files: FileList) => {
      setUploadError(null);
      for (const file of Array.from(files)) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          const message = COPY.errors.attachmentTooLarge(file.name);
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
    () =>
      createHttpClientTransport({
        endpoint: `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/chat`,
        headers: {
          "x-user-id": DEMO_USER_ID,
          "x-conversation-id": sessionId,
        },
        body: (context) => {
          const files = contextFilesRef.current;
          const attachedFiles = files.map((item) => item.name);
          const attachedDocumentIds = files.map((item) => item.id);
          const requestMetadata =
            (context.request as { metadata?: Record<string, unknown> }).metadata ?? {};
          const metadata = {
            ...requestMetadata,
            ...(brdDocumentId ? { phase: "QA", brdDocumentId } : {}),
            ...(attachedFiles.length ? { attachedFiles, attachedDocumentIds } : {}),
          };
          // The request now carries the context; the composer queue starts fresh.
          if (files.length) clearComposerContext();
          return JSON.stringify({
            ...context.request,
            metadata: Object.keys(metadata).length ? metadata : undefined,
          });
        },
      }),
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
    setMentions((prev) => (prev.some((entry) => entry.id === item.id) ? prev : [...prev, item]));
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
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatProvider controller={chat}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
              <ThreadPrimitive.Empty>
                <div className="py-16 text-center">
                  {brdActive ? (
                    <>
                      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-success/15 text-success">
                        <FileText size={22} />
                      </div>
                      <h1 className="font-display text-2xl font-semibold tracking-tight">
                        {COPY.chat.brdReadyTitle}
                      </h1>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        {COPY.chat.brdReadyBody}
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="font-display text-2xl font-semibold tracking-tight">
                        {COPY.chat.emptyTitle}
                      </h1>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        {COPY.chat.emptyBody}
                      </p>
                      <QuickPrompts />
                    </>
                  )}
                </div>
              </ThreadPrimitive.Empty>

              <ThreadPrimitive.Messages>{() => <MessageBubble />}</ThreadPrimitive.Messages>

              <StreamingIndicator />
            </div>
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root
            data-chat-composer={sessionId}
            className="shrink-0 border-t border-border/70 bg-card px-3 py-3 md:px-4"
          >
            <ComposerPrimitive.Attachments className="mb-2 flex flex-wrap items-center gap-2">
              {(attachment) => <ComposerAttachment key={attachment.id} />}
            </ComposerPrimitive.Attachments>

            {uploads.length > 0 && (
              <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap items-center gap-2">
                {uploads.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center gap-2 rounded-lg border bg-muted/50 px-2 py-1 text-xs"
                  >
                    {item.isImage && item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt={item.name}
                        className="size-8 rounded object-cover"
                      />
                    ) : (
                      <FileText size={14} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className="max-w-40 truncate" title={item.name}>
                      {item.name}
                    </span>
                    {item.status === "uploading" ? (
                      <LoaderCircle size={12} className="animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => void removeUpload(item)}
                        aria-label={`Hapus ${item.name}`}
                        className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {mentions.length > 0 && <MentionChips mentions={mentions} onRemove={removeMention} />}

            {uploadError && (
              <p className="mx-auto mb-2 w-full max-w-3xl text-xs text-destructive">
                {uploadError}
              </p>
            )}

            <div className="relative mx-auto w-full max-w-3xl">
              <div className="flex items-end gap-2 rounded-2xl border border-border/80 bg-card p-2 shadow-soft">
                <label
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title={COPY.chat.attachTitle}
                >
                  <Paperclip size={18} />
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
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <AtSign size={18} />
                </button>

                <ComposerPrimitive.TextareaInput
                  className="max-h-48 min-h-10 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                  placeholder={
                    brdActive ? COPY.chat.composerPlaceholderBrd : COPY.chat.composerPlaceholder
                  }
                />

                <ComposerSubmitArea />
              </div>

              <MentionDock
                sessionId={sessionId}
                open={mentionOpen}
                query={mentionQuery}
                onPicked={addMention}
                onClose={() => setMentionOpen(false)}
              />
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </ChatProvider>
    </div>
  );
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
    <div className="mx-auto mb-2 flex w-full max-w-3xl flex-wrap items-center gap-2">
      {mentions.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary"
        >
          <AtSign size={12} className="shrink-0" />
          <span className="max-w-40 truncate" title={item.name}>
            {item.name}
          </span>
          <button
            type="button"
            aria-label={`Hapus mention ${item.name}`}
            onClick={() => {
              composer.setInput(
                composer.input.split(`@${item.name}`).join("").replace(/ {2,}/g, " ").trimStart(),
              );
              onRemove(item.id);
            }}
            className="grid size-4 shrink-0 place-items-center rounded text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function MentionDock({
  sessionId,
  open,
  query,
  onPicked,
  onClose,
}: {
  sessionId: string;
  open: boolean;
  query: string;
  onPicked: (item: MentionItem) => void;
  onClose: () => void;
}) {
  const composer = useComposer();

  if (!open) return null;

  return (
    <MentionPopover
      sessionId={sessionId}
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
      <ComposerPrimitive.Stop className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90">
        <Square size={15} fill="currentColor" />
      </ComposerPrimitive.Stop>
    );
  }

  return (
    <ComposerPrimitive.Submit className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
      <Send size={16} />
    </ComposerPrimitive.Submit>
  );
}

function QuickPrompts() {
  const composer = useComposer();
  return (
    <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-2">
      {COPY.quickPrompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => composer.setInput(prompt)}
          className="rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}

function StreamingIndicator() {
  return (
    <ThreadPrimitive.Loading
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 px-1 text-xs text-muted-foreground"
    >
      <LoaderCircle size={14} className="animate-spin" />
      {COPY.chat.agentWorking}
    </ThreadPrimitive.Loading>
  );
}
