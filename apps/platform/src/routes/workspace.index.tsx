import { useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  FolderOpen,
  Grid2x2,
  List,
  MessageSquare,
  Pencil,
  Plus,
  Sliders,
  Trash,
} from "lucide-react";
import { Alert } from "#/components/base/alert";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Input } from "#/components/base/input";
import { Modal } from "#/components/base/modal";
import { Skeleton } from "#/components/base/skeleton";
import { Logo } from "#/components/brand/logo";
import {
  SettingsModal,
  type SettingsTab,
} from "#/modules/settings/settings-page";
import { useProjects } from "#/modules/projects/hooks/use-projects";
import { COPY } from "#/lib/copy";
import { relativeTime } from "#/lib/time";
import type { ProjectSummary } from "#/lib/api";
import { cn } from "#/lib/utils";

type ViewMode = "grid" | "list";

export const Route = createFileRoute("/workspace/")({
  component: ProjectList,
});

function ProjectList() {
  const navigate = useNavigate();
  const {
    projects,
    loading,
    error,
    createProject,
    renameProject,
    deleteProject,
    creating,
  } = useProjects();

  const [view, setView] = useState<ViewMode>("grid");
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ProjectSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSummary | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("theme");

  const openSettings = useCallback((tab: SettingsTab = "theme") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const openProject = useCallback(
    (id: string) => {
      void navigate({
        to: "/workspace/projects/$projectId",
        params: { projectId: id },
      });
    },
    [navigate],
  );

  return (
    <main className="flex min-h-dvh flex-col bg-slate-100 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />
          <span className="hidden text-xs font-semibold tracking-wider text-slate-500 uppercase sm:block dark:text-slate-400">
            {COPY.projects.title}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 sm:flex dark:border-slate-700 dark:bg-slate-800">
            <button
              type="button"
              title={COPY.projects.gridView}
              aria-label={COPY.projects.gridView}
              onClick={() => setView("grid")}
              className={cn(
                "grid size-6 cursor-pointer place-items-center rounded",
                view === "grid"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              <Grid2x2 size={13} />
            </button>
            <button
              type="button"
              title={COPY.projects.listView}
              aria-label={COPY.projects.listView}
              onClick={() => setView("list")}
              className={cn(
                "grid size-6 cursor-pointer place-items-center rounded",
                view === "list"
                  ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              )}
            >
              <List size={13} />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => openSettings()}>
            <Sliders size={12} className="text-slate-500" />
            <span className="hidden text-[11px] sm:inline">Pengaturan</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            {COPY.projects.newProject}
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {COPY.projects.title}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {COPY.projects.subtitle}
          </p>
        </div>

        {error && (
          <div className="mb-5">
            <Alert>{error}</Alert>
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-40 w-full" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <div className="grid size-12 place-items-center rounded-2xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <FolderOpen size={20} />
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
              {COPY.projects.empty}
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus size={14} />
              {COPY.projects.newProject}
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => openProject(project.id)}
                onRename={() => setRenameTarget(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
            {projects.map((project, index) => (
              <ProjectRow
                key={project.id}
                project={project}
                divide={index > 0}
                onOpen={() => openProject(project.id)}
                onRename={() => setRenameTarget(project)}
                onDelete={() => setDeleteTarget(project)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectModal
        open={createOpen}
        busy={creating}
        onClose={() => setCreateOpen(false)}
        onCreate={async (input) => {
          const project = await createProject(input);
          setCreateOpen(false);
          if (project?.project) openProject(project.project.id);
        }}
      />

      <RenameProjectModal
        key={renameTarget?.id ?? "no-rename"}
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={async (name) => {
          if (renameTarget) await renameProject(renameTarget.id, name);
          setRenameTarget(null);
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={COPY.projects.deleteTitle}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {COPY.projects.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteTarget) void deleteProject(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              {COPY.projects.deleteConfirm}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          {COPY.projects.deleteDescription(deleteTarget?.name ?? "")}
        </p>
      </Modal>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab={settingsTab}
      />
    </main>
  );
}

type ProjectActions = {
  project: ProjectSummary;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function ProjectStats({ project }: { project: ProjectSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="inline-flex items-center gap-1">
        <MessageSquare size={11} />
        {COPY.projects.sessionCount(project.sessionCount)}
      </span>
      <span className="inline-flex items-center gap-1">
        <FileText size={11} />
        {COPY.projects.attachmentCount(project.documentCount)}
      </span>
      <span className="text-slate-400 dark:text-slate-500">
        {relativeTime(project.updatedAt)}
      </span>
    </div>
  );
}

function ProjectBrdBadge({ project }: { project: ProjectSummary }) {
  if (project.brd?.hasPendingModification) {
    return <Badge tone="amber">{COPY.sidebar.badgeDiff}</Badge>;
  }
  if (project.brd) {
    return (
      <Badge tone="emerald">
        {COPY.projects.brdBadge(project.brd.currentVersion)}
      </Badge>
    );
  }
  return <Badge tone="neutral">{COPY.projects.noBrd}</Badge>;
}

function ProjectCard({ project, onOpen, onRename, onDelete }: ProjectActions) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="group relative flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lifted dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <FolderOpen size={15} />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{project.name}</h2>
            {project.isDefault && (
              <span className="text-[10px] text-slate-400">
                {COPY.projects.defaultBadge}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <IconAction title={COPY.projects.rename} onClick={onRename}>
            <Pencil size={12} />
          </IconAction>
          <IconAction title={COPY.projects.delete} onClick={onDelete} danger>
            <Trash size={12} />
          </IconAction>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-8 text-xs leading-5 text-slate-500 dark:text-slate-400">
        {project.description || "—"}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <ProjectStats project={project} />
        <ProjectBrdBadge project={project} />
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  divide,
  onOpen,
  onRename,
  onDelete,
}: ProjectActions & { divide: boolean }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className={cn(
        "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
        divide && "border-t border-slate-100 dark:border-slate-800",
      )}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
        <FolderOpen size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-sm font-semibold">{project.name}</h2>
          {project.isDefault && (
            <span className="text-[10px] text-slate-400">
              {COPY.projects.defaultBadge}
            </span>
          )}
          <ProjectBrdBadge project={project} />
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
          {project.description || "—"}
        </p>
      </div>
      <ProjectStats project={project} />
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <IconAction title={COPY.projects.rename} onClick={onRename}>
          <Pencil size={12} />
        </IconAction>
        <IconAction title={COPY.projects.delete} onClick={onDelete} danger>
          <Trash size={12} />
        </IconAction>
      </div>
    </div>
  );
}

function IconAction({
  title,
  onClick,
  danger = false,
  children,
}: {
  title: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid size-6 cursor-pointer place-items-center rounded text-slate-400 transition-colors",
        danger
          ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
          : "hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function CreateProjectModal({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    description?: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const reset = () => {
    setName("");
    setDescription("");
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={COPY.projects.createTitle}
      description={COPY.projects.createDescription}
      size="sm"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            {COPY.projects.cancel}
          </Button>
          <Button
            disabled={!name.trim() || busy}
            onClick={() => {
              const trimmed = name.trim();
              if (!trimmed) return;
              void onCreate({
                name: trimmed,
                description: description.trim() || null,
              }).then(reset);
            }}
          >
            {COPY.projects.create}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {COPY.projects.nameLabel}
          </span>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={COPY.projects.namePlaceholder}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {COPY.projects.descriptionLabel}
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={COPY.projects.descriptionPlaceholder}
            rows={3}
            className="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </label>
      </div>
    </Modal>
  );
}

function RenameProjectModal({
  target,
  onClose,
  onRename,
}: {
  target: ProjectSummary | null;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState(target?.name ?? "");

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={COPY.projects.renameTitle}
      description={COPY.projects.renameDescription}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {COPY.projects.cancel}
          </Button>
          <Button
            disabled={!value.trim()}
            onClick={() => {
              const trimmed = value.trim();
              if (trimmed) void onRename(trimmed);
            }}
          >
            {COPY.sidebar.save}
          </Button>
        </>
      }
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={COPY.projects.namePlaceholder}
        aria-label={COPY.projects.nameLabel}
      />
    </Modal>
  );
}
