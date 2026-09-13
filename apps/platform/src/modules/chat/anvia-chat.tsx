import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createHttpClientTransport } from "@anvia/client";
import { useChat, type UseChatStatus } from "@anvia/react";
import { ChatProvider, ComposerPrimitive, ThreadPrimitive, useComposer } from "@anvia/react-ui";
import { AtSign, FileText, LoaderCircle, Paperclip, Send, Square, X } from "lucide-react";
import type { UIMessage } from "@anvia/client";
import { DEMO_USER_ID, deleteDocument, uploadDocument } from "#/lib/api";
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

export function AnviaChat({
  sessionId,
  brdDocumentId,
  initialMessages,
  onRunEnded,
  onStatusChange,
}: AnviaChatProps) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<SessionUpload[]>([]);
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
          setUploadError(`${file.name} melebihi batas 10MB.`);
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
        } catch (caught) {
          setUploads((prev) => prev.filter((item) => item.key !== key));
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setUploadError(
            caught instanceof Error ? caught.message : "Gagal mengunggah file.",
          );
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
      } catch (caught) {
        setUploadError(
          caught instanceof Error ? caught.message : "Gagal menghapus file.",
        );
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
          return JSON.stringify({
            ...context.request,
            metadata: Object.keys(metadata).length ? metadata : undefined,
          });
        },
      }),
    [brdDocumentId, sessionId],
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
                      <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                        <FileText size={22} />
                      </div>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        BRD ready — how can I help?
                      </h1>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        Ask about any section, request a modification, or verify the flowchart
                        against the document. Edits are staged as a preview until you approve them.
                      </p>
                    </>
                  ) : (
                    <>
                      <h1 className="text-2xl font-semibold tracking-tight">
                        System Analyst AI Assistant
                      </h1>
                      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                        Describe a user story, ask about an existing BRD, or request a web search to
                        research companies and requirements.
                      </p>
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
            className="shrink-0 border-t bg-white px-3 py-3 md:px-4"
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
              <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
                <label
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Lampirkan dokumen atau gambar (maks 10MB)"
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
                  aria-label="Mention a file from this session"
                  title="Mention a file from this session (@)"
                  onClick={() => setMentionOpen((open) => !open)}
                  className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <AtSign size={18} />
                </button>

                <ComposerPrimitive.TextareaInput
                  className="max-h-48 min-h-10 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                  placeholder={
                    brdActive
                      ? "Ask about the BRD… (tip: @ mentions session files)"
                      : "Describe your user story… (tip: @ mentions session files)"
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
                composer.input
                  .split(`@${item.name}`)
                  .join("")
                  .replace(/ {2,}/g, " ")
                  .trimStart(),
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

function StreamingIndicator() {
  return (
    <ThreadPrimitive.Loading className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <LoaderCircle size={14} className="animate-spin" />
      Agent is working…
    </ThreadPrimitive.Loading>
  );
}
