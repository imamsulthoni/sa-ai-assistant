import { MessagePrimitive, useAttachment, useMessage, useMessagePart } from "@anvia/react-ui";
import { Brain, Copy, FileText, LoaderCircle, RefreshCw, Wrench, X } from "lucide-react";

export function MessageBubble() {
  const { message } = useMessage();
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <MessagePrimitive.Root className="max-w-[85%] rounded-2xl rounded-br-md bg-muted px-3 py-2 text-[15px] leading-7 sm:max-w-[75%]">
          <MessagePrimitive.Content>
            <MessagePrimitive.Parts>{() => <UserPart />}</MessagePrimitive.Parts>
          </MessagePrimitive.Content>
        </MessagePrimitive.Root>
      </div>
    );
  }

  return (
    <div className="group flex justify-start">
      <div className="flex max-w-[92%] flex-col gap-1.5 sm:max-w-[85%]">
        <MessagePrimitive.Root className="min-w-0">
          <MessagePrimitive.Content className="text-[15px] leading-7">
            <MessagePrimitive.Parts>{() => <AssistantPart />}</MessagePrimitive.Parts>
          </MessagePrimitive.Content>
        </MessagePrimitive.Root>
        <MessagePrimitive.Actions className="flex items-center gap-1 pl-1 opacity-100 focus-within:opacity-100 md:opacity-0 md:group-hover:opacity-100">
          <MessagePrimitive.Copy className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Copy size={13} />
            Copy
          </MessagePrimitive.Copy>
          <MessagePrimitive.Regenerate className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <RefreshCw size={13} />
            Regenerate
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
      return <MessagePrimitive.Markdown className="min-w-0 whitespace-pre-wrap" />;
    case "reasoning":
      return (
        <MessagePrimitive.Reasoning className="my-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium">
            <Brain size={14} />
            Thinking
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap font-sans">
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
        <MessagePrimitive.Data className="my-2 overflow-auto rounded-lg bg-muted/50 p-2 text-xs" />
      );
    default:
      return (
        <MessagePrimitive.Error className="my-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive" />
      );
  }
}

function ToolCall() {
  const { part } = useMessagePart();
  if (part.type !== "tool") return null;

  const running = part.state === "input-streaming" || part.state === "input-available";

  return (
    <MessagePrimitive.Tool className="my-2 inline-flex max-w-full items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Wrench size={14} className="shrink-0" />
      <MessagePrimitive.ToolName className="truncate font-medium text-foreground" />
      {running ? (
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <LoaderCircle size={12} className="animate-spin" />
          Running
        </span>
      ) : (
        <MessagePrimitive.ToolStatus className="shrink-0" />
      )}
      {part.state === "error" && <MessagePrimitive.ToolError className="text-destructive" />}
    </MessagePrimitive.Tool>
  );
}

function AttachmentView({
  attachment,
}: {
  attachment: { name?: string; mediaType?: string; url?: string; data?: string };
}) {
  const isImage =
    attachment.mediaType?.startsWith("image/") || attachment.url?.startsWith("data:image/");

  return (
    <div className="my-1 flex max-w-full items-center gap-2 overflow-hidden rounded-lg border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
      {isImage ? (
        <FileText size={14} className="shrink-0" />
      ) : (
        <FileText size={14} className="shrink-0" />
      )}
      <span className="truncate">{attachment.name ?? "Attachment"}</span>
    </div>
  );
}

export function ComposerAttachment() {
  const { attachment, remove } = useAttachment();
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-1 text-xs text-foreground">
      <FileText size={14} className="shrink-0 text-muted-foreground" />
      <span className="max-w-36 truncate sm:max-w-48">{attachment.name ?? "Attachment"}</span>
      {remove && (
        <button
          type="button"
          onClick={remove}
          aria-label={`Remove ${attachment.name ?? "attachment"}`}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
