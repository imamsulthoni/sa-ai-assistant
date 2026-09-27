import { useState } from "react";
import { ArrowLeft, Clock, FileText, Layers, Pencil, Plus, Sliders, Trash, X } from "lucide-react";
import { cn } from "#/lib/utils";
import type { SessionSummary } from "#/lib/api";
import { Badge, type BadgeTone } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Input } from "#/components/base/input";
import { Modal } from "#/components/base/modal";
import { Skeleton } from "#/components/base/skeleton";
import { COPY } from "#/lib/copy";
import { relativeTime } from "#/lib/time";
import { useCloseMobileSidebar } from "#/modules/chat/chat-shell";
import type { SettingsTab } from "#/modules/settings/settings-page";

export type ActiveSessionBadge = { label: string; tone: BadgeTone };

/** Badge status dari data server, dipakai untuk sesi yang tidak sedang dibuka. */
function sessionBadge(session: SessionSummary): ActiveSessionBadge {
  if (session.brd?.hasPendingModification) {
    return { label: COPY.sidebar.badgeDiff, tone: "amber" };
  }
  if (session.brd) {
    return { label: `v${session.brd.currentVersion}.0`, tone: "emerald" };
  }
  if (session.flow?.phase === "GENERATING") {
    return { label: COPY.sidebar.badgeGenerating, tone: "amber" };
  }
  if (session.flow) {
    return { label: `R${session.flow.round}`, tone: "sky" };
  }
  return { label: COPY.sidebar.badgeDraft, tone: "neutral" };
}

type SessionSidebarProps = {
  sessions: SessionSummary[];
  activeId: string | null;
  loading: boolean;
  disabled?: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  templateName?: string | null;
  activeBadge?: ActiveSessionBadge | null;
  onOpenSettings: (tab?: SettingsTab) => void;
  projectName?: string | null;
  onBackToProjects?: () => void;
  /** Sesi baru hanya boleh dibuat setelah project punya BRD. */
  newDisabled?: boolean;
  newDisabledHint?: string;
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
  templateName,
  activeBadge,
  onOpenSettings,
  projectName,
  onBackToProjects,
  newDisabled = false,
  newDisabledHint,
}: SessionSidebarProps) {
  const closeMobile = useCloseMobileSidebar();
  const [renameTarget, setRenameTarget] = useState<SessionSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card text-foreground select-none">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {onBackToProjects && (
            <button
              type="button"
              onClick={onBackToProjects}
              title={COPY.projects.backToProjects}
              aria-label={COPY.projects.backToProjects}
              className="grid size-6 shrink-0 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft size={14} />
            </button>
          )}
          <div className="min-w-0">
            <span className="block text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
              {projectName ? COPY.sidebar.projectLabel : "Workspace"}
            </span>
            <h2 className="max-w-[180px] truncate text-xs font-bold text-foreground">
              {projectName ?? COPY.sidebar.workspaceName}
            </h2>
          </div>
        </div>
        {closeMobile && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={closeMobile}
            aria-label={COPY.shell.closeMenu}
          >
            <X size={15} />
          </Button>
        )}
      </div>

      <div className="border-b border-border p-2.5">
        <button
          type="button"
          onClick={onNew}
          disabled={disabled || newDisabled}
          title={newDisabled ? (newDisabledHint ?? COPY.sidebar.newChatLocked) : undefined}
          className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background shadow-xs transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} />
          <span>{COPY.sidebar.newChat}</span>
        </button>
        {newDisabled && (
          <p className="mt-1.5 text-center text-[10px] leading-4 text-muted-foreground">
            {newDisabledHint ?? COPY.sidebar.newChatLocked}
          </p>
        )}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-1.5">
        <div className="flex items-center justify-between px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          <span>{COPY.sidebar.conversations}</span>
          <span className="font-mono">{sessions.length}</span>
        </div>

        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full bg-muted" />
          ))}

        {!loading && sessions.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {COPY.sidebar.noConversations}
          </p>
        )}

        {sessions.map((session) => {
          const active = session.id === activeId;
          const badge = active && activeBadge ? activeBadge : sessionBadge(session);
          return (
            <div
              key={session.id}
              className={cn(
                "group relative cursor-pointer rounded-lg border p-2.5 transition-colors",
                active
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted",
              )}
              onClick={() => {
                if (disabled) return;
                onOpen(session.id);
                closeMobile?.();
              }}
            >
              <div className="flex items-start gap-2 overflow-hidden">
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded",
                    active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                  )}
                >
                  <FileText size={12} />
                </span>
                <div className="min-w-0 flex-1">
                  <h4
                    className={cn(
                      "truncate text-xs leading-snug font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {session.title}
                  </h4>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={badge.tone} className="text-[9px]">
                      {badge.label}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground">
                      {relativeTime(session.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {relativeTime(session.createdAt)}
                </span>
                <span>{COPY.sidebar.messageCount(session.messageCount)}</span>
              </div>

              <div className="absolute top-2 right-2 hidden items-center gap-0.5 group-hover:flex">
                <button
                  type="button"
                  title={COPY.sidebar.rename}
                  aria-label={`${COPY.sidebar.rename} ${session.title}`}
                  className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    setRenameTarget(session);
                  }}
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  title={COPY.sidebar.delete}
                  aria-label={`${COPY.sidebar.delete} ${session.title}`}
                  className="grid size-6 cursor-pointer place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDeleteTarget(session);
                  }}
                >
                  <Trash size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-1 border-t border-border bg-background p-2">
        <button
          type="button"
          onClick={() => onOpenSettings("template")}
          className="w-full cursor-pointer rounded-md border border-border bg-muted p-2 text-left transition-colors"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-foreground">
              <Layers size={12} className="text-muted-foreground" /> {COPY.sidebar.templateSection}
            </span>
            <span className="text-[10px] text-muted-foreground">{COPY.sidebar.manage}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-foreground">
            {templateName || COPY.sidebar.noTemplate}
          </p>
        </button>

        <button
          type="button"
          onClick={() => onOpenSettings()}
          className="flex w-full cursor-pointer items-center justify-between rounded-md bg-muted px-2 py-1.5 text-left text-xs text-foreground transition-colors"
        >
          <span className="flex items-center gap-1.5 text-[11px]">
            <Sliders size={12} className="text-muted-foreground" />
            <span>{COPY.sidebar.allSettings}</span>
          </span>
        </button>
      </div>

      <RenameDialog
        key={renameTarget?.id ?? "no-rename-target"}
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={(title) => {
          if (renameTarget) onRename(renameTarget.id, title);
          setRenameTarget(null);
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={COPY.sidebar.deleteTitle}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {COPY.sidebar.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {COPY.sidebar.deleteConfirm}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-5 text-muted-foreground">
          {COPY.sidebar.deleteDescription(deleteTarget?.title ?? "")}
        </p>
      </Modal>
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
    <Modal
      open={target !== null}
      onClose={onClose}
      title={COPY.sidebar.renameTitle}
      description={COPY.sidebar.renameDescription}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {COPY.sidebar.cancel}
          </Button>
          <Button disabled={!value.trim()} onClick={() => value.trim() && onRename(value.trim())}>
            {COPY.sidebar.save}
          </Button>
        </>
      }
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={COPY.sidebar.renamePlaceholder}
        aria-label={COPY.sidebar.renamePlaceholder}
      />
    </Modal>
  );
}
