import { useState } from "react";
import { cn } from "#/lib/utils";
import {
  CheckCircle2,
  EllipsisVertical,
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
import { COPY, formatBytes, statusLabel } from "#/lib/copy";

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
      <Button className="mb-4 w-full justify-start" onClick={onNew} disabled={disabled}>
        <Plus size={16} /> {COPY.sidebar.newChat}
      </Button>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 pr-1">
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
            {COPY.sidebar.conversations}
          </p>

          {loading &&
            Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}

          {!loading && sessions.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {COPY.sidebar.noConversations}
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
                  active && "bg-sidebar-accent ring-1 ring-primary/15",
                )}
              >
                <button
                  type="button"
                  onClick={() => onOpen(session.id)}
                  disabled={disabled}
                  data-active={active ? "" : undefined}
                  className={cn(
                    "flex h-9 min-w-0 flex-1 items-center rounded-lg px-3 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:pointer-events-none disabled:opacity-50",
                    active && "font-medium text-foreground",
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
                      aria-label={`Aksi untuk ${session.title}`}
                      className="mr-1 size-7 shrink-0 text-muted-foreground opacity-100 transition-colors hover:bg-sidebar-accent hover:text-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground"
                    >
                      <EllipsisVertical size={14} />
                      <span className="sr-only">Ganti nama atau hapus percakapan</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem onSelect={() => setRenameTarget(session)}>
                      <Pencil /> {COPY.sidebar.rename}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setDeleteTarget(session)}
                    >
                      <Trash /> {COPY.sidebar.delete}
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
        key={renameTarget?.id ?? "no-rename-target"}
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
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);

  return (
    <section
      className={cn(
        "mt-6 rounded-xl border border-transparent px-2 pt-4 transition-colors",
        dragging && "border-primary/40 bg-primary/5",
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files?.length) onUpload(event.dataTransfer.files);
      }}
    >
      <div className="mb-2 flex items-center justify-between border-t border-border/60 pt-4">
        <p className="text-xs font-medium text-muted-foreground">{COPY.sidebar.sessionDocuments}</p>
        <label
          className="grid size-7 cursor-pointer place-items-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          title={COPY.sidebar.uploadDocuments}
        >
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

      {loading && <p className="text-xs text-muted-foreground">{COPY.sidebar.loadingFiles}</p>}
      {!loading && documents.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-3 text-xs leading-5 text-muted-foreground">
          {COPY.sidebar.uploadDocuments}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {documents.map((document) => {
          const transient = document.status === "UPLOADING" || document.status === "PROCESSING";
          return (
            <div
              key={document.id}
              className="group flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-sidebar-accent"
            >
              <DocumentStatusIcon status={document.status} />
              <span className="min-w-0 flex-1 truncate" title={document.title}>
                {document.title}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[10px] tracking-wide uppercase",
                  document.status === "FAILED" ? "text-destructive" : "text-muted-foreground",
                )}
                title={`${statusLabel(document.status)} · ${formatBytes(document.fileSize)}`}
              >
                {transient ? statusLabel(document.status) : formatBytes(document.fileSize)}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground opacity-70 transition-opacity hover:text-destructive hover:opacity-100"
                onClick={() => setDeleteTarget(document)}
                aria-label={`Hapus ${document.title}`}
              >
                <XCircle size={13} />
              </button>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.sidebar.deleteDocumentTitle}</DialogTitle>
            <DialogDescription>
              {COPY.sidebar.deleteDocumentDescription(deleteTarget?.title ?? "")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              {COPY.sidebar.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {COPY.sidebar.deleteDocumentConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DocumentStatusIcon({ status }: { status: DocumentSummary["status"] }) {
  if (status === "READY") return <CheckCircle2 size={13} className="shrink-0 text-success" />;
  if (status === "FAILED") return <XCircle size={13} className="shrink-0 text-destructive" />;
  return <LoaderCircle size={13} className="shrink-0 animate-spin text-primary" />;
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
          <DialogTitle>{COPY.sidebar.renameTitle}</DialogTitle>
          <DialogDescription>{COPY.sidebar.renameDescription}</DialogDescription>
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
            placeholder={COPY.sidebar.renamePlaceholder}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {COPY.sidebar.cancel}
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              {COPY.sidebar.save}
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
          <DialogTitle>{COPY.sidebar.deleteTitle}</DialogTitle>
          <DialogDescription>
            {COPY.sidebar.deleteDescription(target?.title ?? "")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {COPY.sidebar.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onDelete}>
            {COPY.sidebar.deleteConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
