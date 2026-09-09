import { useEffect, useMemo } from "react";
import { createHttpClientTransport } from "@anvia/client";
import { useChat, type UseChatStatus } from "@anvia/react";
import {
  ChatProvider,
  ComposerPrimitive,
  ThreadPrimitive,
  useComposer,
} from "@anvia/react-ui";
import { LoaderCircle, Paperclip, Send, Square } from "lucide-react";
import type { UIMessage } from "@anvia/client";
import { DEMO_USER_ID } from "#/lib/api";
import {
  ComposerAttachment,
  MessageBubble,
} from "#/components/chat/message-bubble";

type AnviaChatProps = {
  sessionId: string;
  initialMessages: UIMessage[];
  onRunEnded?: () => void;
  onStatusChange?: (status: UseChatStatus) => void;
};

export function AnviaChat({
  sessionId,
  initialMessages,
  onRunEnded,
  onStatusChange,
}: AnviaChatProps) {
  const transport = useMemo(
    () =>
      createHttpClientTransport({
        endpoint: `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/chat`,
        headers: {
          "x-user-id": DEMO_USER_ID,
          "x-conversation-id": sessionId,
        },
      }),
    [sessionId],
  );

  const chat = useChat({
    transport,
    initialMessages,
    onEvent: (event) => {
      if (event.type === "run_end" || event.type === "error") {
        onRunEnded?.();
      }
    },
  });

  useEffect(() => {
    onStatusChange?.(chat.status);
  }, [chat.status, onStatusChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatProvider controller={chat}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 md:py-10">
              <ThreadPrimitive.Empty>
                <div className="py-16 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    System Analyst AI Assistant
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Describe a user story, ask about an existing BRD, or request a
                    web search to research companies and requirements.
                  </p>
                </div>
              </ThreadPrimitive.Empty>

              <ThreadPrimitive.Messages>
                {() => <MessageBubble />}
              </ThreadPrimitive.Messages>

              <StreamingIndicator />
            </div>
          </ThreadPrimitive.Viewport>

          <ComposerPrimitive.Root className="shrink-0 border-t bg-white px-3 py-3 md:px-4">
            <ComposerPrimitive.Attachments className="mb-2 flex flex-wrap items-center gap-2">
              {(attachment) => <ComposerAttachment key={attachment.id} />}
            </ComposerPrimitive.Attachments>

            <div className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              <ComposerPrimitive.AddAttachment
                multiple
                className="grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                aria-label="Attach files"
              >
                <Paperclip size={18} />
              </ComposerPrimitive.AddAttachment>

              <ComposerPrimitive.TextareaInput
                className="max-h-48 min-h-10 w-full resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                placeholder="Describe your user story…"
              />

              <ComposerSubmitArea />
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </ChatProvider>
    </div>
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
