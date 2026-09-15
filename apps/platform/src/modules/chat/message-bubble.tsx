import { MessagePrimitive, useAttachment, useMessage, useMessagePart } from "@anvia/react-ui";
import { Bot, Brain, Copy, FileText, LoaderCircle, RefreshCw, User, Wrench, X } from "lucide-react";
import { MarkdownContent } from "#/components/markdown/markdown-content";
import { toolLabel } from "#/lib/copy";

export function MessageBubble() {
  const { message } = useMessage();

  if (message.role === "system") {
    return (
      <div className="my-1 text-center">
        <MessagePrimitive.Content className="inline-block rounded-full border border-slate-300/60 bg-slate-200/70 px-2.5 py-0.5 text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          <MessagePrimitive.Parts>{() => <MessagePrimitive.Text />}</MessagePrimitive.Parts>
        </MessagePrimitive.Content>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex items-start justify-end gap-2">
        <div className="max-w-[85%] rounded-lg rounded-tr-xs bg-slate-900 p-2.5 text-xs leading-relaxed text-white dark:bg-slate-100 dark:text-slate-900">
          <MessagePrimitive.Root className="min-w-0">
            <MessagePrimitive.Content>
              <MessagePrimitive.Parts>{() => <UserPart />}</MessagePrimitive.Parts>
            </MessagePrimitive.Content>
          </MessagePrimitive.Root>
        </div>
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-800 text-white dark:bg-slate-700">
          <User size={12} />
        </span>
      </div>
    );
  }

  if (message.role === "tool") {
    return (
      <div className="mx-auto max-w-[95%]">
        <MessagePrimitive.Root className="min-w-0">
          <MessagePrimitive.Content>
            <MessagePrimitive.Parts>{() => <AssistantPart />}</MessagePrimitive.Parts>
          </MessagePrimitive.Content>
        </MessagePrimitive.Root>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900">
        <Bot size={12} />
      </span>
      <div className="flex min-w-0 max-w-[85%] flex-col gap-1">
        <div className="rounded-lg rounded-tl-xs border border-slate-200 bg-white p-2.5 text-xs leading-relaxed shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <MessagePrimitive.Root className="min-w-0">
            <MessagePrimitive.Content>
              <MessagePrimitive.Parts>{() => <AssistantPart />}</MessagePrimitive.Parts>
            </MessagePrimitive.Content>
          </MessagePrimitive.Root>
        </div>
        <MessagePrimitive.Actions className="flex items-center gap-1 pl-1 opacity-100 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <MessagePrimitive.Copy className="inline-flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
            <Copy size={12} />
            Salin
          </MessagePrimitive.Copy>
          <MessagePrimitive.Regenerate className="inline-flex h-6 cursor-pointer items-center gap-1 rounded px-1.5 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100">
            <RefreshCw size={12} />
            Ulangi
          </MessagePrimitive.Regenerate>
        </MessagePrimitive.Actions>
      </div>
    </div>
  );
}

function UserPart() {
  const { part } = useMessagePart();
  if (part.type === "text") {
    return <MessagePrimitive.Text className="whitespace-pre-wrap" />;
  }
  if (part.type === "attachment") {
    return (
      <MessagePrimitive.Attachment>
        {(attachment) => <AttachmentView attachment={attachment} />}
      </MessagePrimitive.Attachment>
    );
  }
  return <MessagePrimitive.Error />;
}

function AssistantPart() {
  const { part } = useMessagePart();
  switch (part.type) {
    case "text":
      return <MarkdownContent source={part.text} />;
    case "reasoning":
      return (
        <MessagePrimitive.Reasoning className="my-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <summary className="flex cursor-pointer items-center gap-1.5 font-medium select-none">
            <Brain size={13} />
            Proses berpikir
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto font-sans whitespace-pre-wrap">
            {part.text}
          </pre>
        </MessagePrimitive.Reasoning>
      );
    case "tool":
      return <ToolCall />;
    case "attachment":
      return (
        <MessagePrimitive.Attachment>
          {(attachment) => <AttachmentView attachment={attachment} />}
        </MessagePrimitive.Attachment>
      );
    case "data":
      return (
        <MessagePrimitive.Data className="my-2 overflow-auto rounded-lg bg-slate-100 p-2 text-[11px] dark:bg-slate-800" />
      );
    default:
      return (
        <MessagePrimitive.Error className="my-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300" />
      );
  }
}

function ToolCall() {
  const { part } = useMessagePart();
  if (part.type !== "tool") return null;

  const running = part.state === "input-streaming" || part.state === "input-available";

  return (
    <MessagePrimitive.Tool className="my-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
      <Wrench size={13} className="shrink-0" />
      <MessagePrimitive.ToolName className="truncate font-medium text-slate-800 dark:text-slate-200">
        {toolLabel(part.toolName)}
      </MessagePrimitive.ToolName>
      {running ? (
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LoaderCircle size={11} className="animate-spin" />
          Berjalan
        </span>
      ) : (
        <MessagePrimitive.ToolStatus className="shrink-0" />
      )}
      {part.state === "error" && <MessagePrimitive.ToolError className="text-rose-600" />}
    </MessagePrimitive.Tool>
  );
}

function AttachmentView({
  attachment,
}: {
  attachment: { name?: string; mediaType?: string; url?: string; data?: string };
}) {
  return (
    <div className="my-1 flex max-w-full items-center gap-2 overflow-hidden rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] dark:border-slate-700 dark:bg-slate-800">
      <FileText size={12} className="shrink-0" />
      <span className="truncate">{attachment.name ?? "Lampiran"}</span>
    </div>
  );
}

export function ComposerAttachment() {
  const { attachment, remove } = useAttachment();
  return (
    <div className="flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <FileText size={12} className="shrink-0 text-slate-400" />
      <span className="max-w-36 truncate sm:max-w-48">{attachment.name ?? "Lampiran"}</span>
      {remove && (
        <button
          type="button"
          onClick={remove}
          aria-label={`Hapus ${attachment.name ?? "lampiran"}`}
          className="grid size-4 shrink-0 cursor-pointer place-items-center rounded text-slate-400 transition-colors hover:text-rose-500"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}
