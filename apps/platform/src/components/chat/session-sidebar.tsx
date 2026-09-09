import { useState } from "react";
import { Bot, EllipsisVertical, Pencil, Plus, Trash } from "lucide-react";
import type { SessionSummary } from "#/lib/api";
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
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">
            Conversations
          </p>

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
                className="group flex items-center rounded-lg data-[active]:bg-accent"
              >
                <button
                  type="button"
                  onClick={() => onOpen(session.id)}
                  disabled={disabled}
                  data-active={active ? "" : undefined}
                  className="flex h-9 min-w-0 flex-1 items-center rounded-lg px-3 text-left text-sm text-foreground hover:bg-accent data-[active]:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="truncate">{session.title}</span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      className="mr-1 size-7 shrink-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:opacity-100 data-[state=open]:bg-accent data-[state=open]:text-foreground"
                    >
                      <EllipsisVertical size={14} />
                      <span className="sr-only">Actions</span>
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
          <DialogDescription>
            Give this conversation a more descriptive name.
          </DialogDescription>
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
            This permanently deletes “{target?.title}” and its messages. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
