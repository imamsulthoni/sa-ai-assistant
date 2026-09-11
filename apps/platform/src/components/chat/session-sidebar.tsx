import { useState } from "react";
import { cn } from "cn";
import {
  Bot,
  CheckCircle2,
  EllipsisVertical,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Trash,
  Upload,
  XCircle,
} from "lucide-react";
import type { DocumentSummary, SessionSummary } from "#/lib/api";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";

type SessionSidebarProps = {
  sessions: SessionSummary[];
  activeId: string | null;
  loading: boolean;
  disabled?: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  documents: DocumentSummary[];
  documentsLoading: boolean;
  documentsUploading: boolean;
  documentsError: string | null;
  onUploadDocuments: (files: FileList) => void;
  onDeleteDocument: (id: string) => void;
};

export function SessionSidebar({
  sessions,
  activeId,
  loading,
  disabled = false,
  onNew,
  onOpen,
  onRename,
  onDelete,
  documents,
  documentsLoading,
  documentsUploading,
  documentsError,
  onUploadDocuments,
  onDeleteDocument,
}: SessionSidebarProps) {
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-4 flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold">
        <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
          <Bot size={16} />
        </span>
        Agent workspace
      </div>

      <Button className="w-full justify-start" onClick={onNew} disabled={disabled}>
        <Plus size={16} /> New chat
      </Button>

      <ScrollArea className="mt-4 min-h-0 flex-1">
        <div className="flex flex-col gap-1 pr-1">
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Conversations</p>

          {loading &&
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}

          {!loading && sessions.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              No conversations yet.
            </p>
          )}

          {sessions.map((session) => {
            const active = session.id === activeId;
            return (
              <div
                key={session.id}
                data-active={active ? "" : undefined}
                className={cn(
                  "group flex items-center rounded-lg",
                  active && "bg-accent ring-1 ring-accent-foreground/15",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(session.id)}
                  disabled={disabled}
                  data-active={active ? "" : undefined}
                  className={cn(
                    "flex h-9 min-w-0 flex-1 items-center rounded-lg px-3 text-left text-sm text-foreground hover:bg-accent data-[active]:bg-accent disabled:pointer-events-none disabled:opacity-50",
                    active && "font-medium",
                  )}
                >
                  {active && <span className="mr-2 size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span className="truncate">{session.title}</span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      aria-label={`Actions for ${session.title}`}
                      className="mr-1 size-7 shrink-0 text-muted-foreground transition-colors opacity-100 hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                    >
                      <EllipsisVertical size={14} />
                      <span className="sr-only">Rename or delete session</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => setRenameTarget(session)}>
                      <Pencil /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteTarget(session)}
                    >
                      <Trash /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          {activeId && (
            <SessionDocuments
              documents={documents}
              loading={documentsLoading}
              uploading={documentsUploading}
              error={documentsError}
              onUpload={onUploadDocuments}
              onDelete={onDeleteDocument}
            />
          )}
        </div>
      </ScrollArea>

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={(title) => {
          if (renameTarget) onRename(renameTarget.id, title);
          setRenameTarget(null);
        }}
      />

      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDelete={() => {
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function SessionDocuments({
  documents,
  loading,
  uploading,
  error,
  onUpload,
  onDelete,
}: {
  documents: DocumentSummary[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  onUpload: (files: FileList) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mt-6 border-t px-2 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Session documents</p>
        <label className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
          {uploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
          <input
            type="file"
            multiple
            className="sr-only"
            accept=".pdf,.md,.markdown,.docx,.png,.jpg,.jpeg,.webp,.tiff"
            disabled={uploading}
            onChange={(event) => {
              if (event.currentTarget.files?.length) onUpload(event.currentTarget.files);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading files…</p>}
      {!loading && documents.length === 0 && (
        <p className="text-xs leading-5 text-muted-foreground">
          Upload a BRD, PDF, or flowchart for this session.
        </p>
      )}
      <div className="flex flex-col gap-1">
        {documents.map((document) => (
          <div
            key={document.id}
            className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
          >
            <FileText size={14} className="shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate" title={document.title}>
              {document.title}
            </span>
            <DocumentStatus status={document.status} />
            <button
              type="button"
              className="shrink-0 text-muted-foreground opacity-70 transition-opacity hover:text-destructive hover:opacity-100"
              onClick={() => onDelete(document.id)}
              aria-label={`Delete ${document.title}`}
            >
              <XCircle size={13} />
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </section>
  );
}

function DocumentStatus({ status }: { status: DocumentSummary["status"] }) {
  if (status === "READY") return <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />;
  if (status === "FAILED") return <XCircle size={13} className="shrink-0 text-destructive" />;
  return <LoaderCircle size={13} className="shrink-0 animate-spin text-muted-foreground" />;
}

function RenameDialog({
  target,
  onClose,
  onRename,
}: {
  target: SessionSummary | null;
  onClose: () => void;
  onRename: (title: string) => void;
}) {
  const [value, setValue] = useState(target?.title ?? "");

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename conversation</DialogTitle>
          <DialogDescription>Give this conversation a more descriptive name.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (value.trim()) onRename(value.trim());
          }}
        >
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Conversation title"
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  onClose,
  onDelete,
}: {
  target: SessionSummary | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete conversation?</DialogTitle>
          <DialogDescription>
            This permanently deletes “{target?.title}” and its messages. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
