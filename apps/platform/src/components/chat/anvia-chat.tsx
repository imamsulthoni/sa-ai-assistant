import { createHttpClientTransport } from "@anvia/client";
import { useChat } from "@anvia/react";
import {
  ChatProvider,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@anvia/react-ui";

const transport = createHttpClientTransport({
  endpoint: `${import.meta.env.VITE_API_URL ?? "http://localhost:8000"}/chat`,
});

export function AnviaChat() {
  const chat = useChat({ transport });

  return (
    <div className="flex flex-1 flex-col">
      <ChatProvider controller={chat}>
        <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-5 py-10 md:px-8 md:py-14">
              <ThreadPrimitive.Empty>
                <div className="py-20 text-center">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    System Analyst AI Assistant
                  </h1>
                  <p className="mt-2 text-sm text-neutral-500">
                    Describe a user story or ask about your BRD.
                  </p>
                </div>
              </ThreadPrimitive.Empty>
              <ThreadPrimitive.Messages>
                <MessagePrimitive.Root className="mb-7 flex gap-3 data-[role=user]:justify-end">
                  <MessagePrimitive.Content className="max-w-[80%] whitespace-pre-wrap text-[15px] leading-7 data-[role=user]:rounded-2xl data-[role=user]:bg-neutral-100 data-[role=user]:px-4 data-[role=user]:py-2.5">
                    <MessagePrimitive.Parts />
                  </MessagePrimitive.Content>
                </MessagePrimitive.Root>
              </ThreadPrimitive.Messages>
              <ThreadPrimitive.Error />
            </div>
          </ThreadPrimitive.Viewport>
          <ComposerPrimitive.Root className="mx-auto mb-5 w-full max-w-3xl rounded-2xl border bg-white p-2 shadow-[0_4px_20px_rgba(0,0,0,0.08)] md:mb-8 md:px-8">
            <ComposerPrimitive.TextareaInput
              className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none"
              placeholder="Describe your user story..."
            />
            <div className="flex justify-end px-1">
              <ComposerPrimitive.Submit className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white">
                Send
              </ComposerPrimitive.Submit>
            </div>
          </ComposerPrimitive.Root>
        </ThreadPrimitive.Root>
      </ChatProvider>
    </div>
  );
}
