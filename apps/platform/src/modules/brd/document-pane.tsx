import { useEffect, useMemo, useState } from "react";
import { Check, Download, FileDown, RotateCcw, X } from "lucide-react";
import { cn } from "#/lib/utils";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { MarkdownContent } from "#/components/markdown/markdown-content";
import { buildCompactDiff, countDiffChanges } from "#/lib/diff";
import {
  approveBrdModification,
  exportBrd,
  rejectBrdModification,
  updateBrdStatus,
  type BrdDocument,
} from "#/lib/api";
import { BRD_STATUS_ACTIONS, BRD_STATUS_LABEL } from "#/lib/copy";
import { notify } from "#/lib/notify";
import { BrdDiffView } from "./brd-diff-view";

type DocumentPaneProps = {
  brd: BrdDocument;
  content: string;
  diff: string | null;
  onDiff: (from: number, to: number) => void;
  onRestore: (version: number) => void;
  onClearDiff: () => void;
  onApproved: (brd: BrdDocument) => void;
  busy?: boolean;
};

export function DocumentPane({
  brd,
  content,
  diff,
  onDiff,
  onRestore,
  onClearDiff,
  onApproved,
  busy,
}: DocumentPaneProps) {
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState(brd.currentVersion);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [view, setView] = useState<"document" | "changes">("document");
  const versions = brd.versions ?? [];
  const pending = brd.pendingContentMarkdown;

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    setSelected(brd.currentVersion);
    onClearDiff();
  }, [brd.id, brd.currentVersion, onClearDiff]);

  useEffect(() => {
    if (pending) setView("changes");
  }, [pending]);

  const pendingCounts = useMemo(
    () => (pending ? countDiffChanges(buildCompactDiff(content, pending)) : null),
    [content, pending],
  );

  const current = brd.currentVersion;
  const statusActions = BRD_STATUS_ACTIONS[brd.status] ?? [];
  const approve = async () => {
    setApprovalBusy(true);
    try {
      const result = await approveBrdModification(brd.id);
      onApproved(result.brd);
      notify.success("Perubahan BRD disetujui sebagai versi baru.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal menyetujui perubahan.");
    } finally {
      setApprovalBusy(false);
    }
  };
  const reject = async () => {
    setApprovalBusy(true);
    try {
      await rejectBrdModification(brd.id);
      onApproved({ ...brd, pendingContentMarkdown: null, pendingChangeSummary: null });
      notify.info("Pratinjau perubahan ditolak.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal menolak perubahan.");
    } finally {
      setApprovalBusy(false);
    }
  };
  const changeStatus = async (next: BrdDocument["status"]) => {
    setStatusBusy(true);
    try {
      const result = await updateBrdStatus(brd.id, next);
      onApproved(result.brd);
      notify.success(`Status BRD diperbarui: ${BRD_STATUS_LABEL[next]}.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal mengubah status BRD.");
    } finally {
      setStatusBusy(false);
    }
  };
  const handleExport = async (format: "markdown" | "pdf") => {
    const toastId = notify.loading("Menyiapkan berkas…");
    try {
      await exportBrd(brd.id, format);
      notify.dismiss(toastId);
      notify.success("Berkas berhasil diunduh.");
    } catch (error) {
      notify.dismiss(toastId);
      notify.error(error instanceof Error ? error.message : "Export gagal.");
    }
  };

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-background"
      data-color-mode={dark ? "dark" : "light"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              BRD
            </p>
            <Badge variant={statusVariant(brd.status)}>{BRD_STATUS_LABEL[brd.status]}</Badge>
          </div>
          <h2 className="truncate font-display font-semibold">{brd.title}</h2>
          {brd.status === "APPROVED" && brd.approvedBy && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Disetujui oleh {brd.approvedBy}
              {brd.approvedAt
                ? ` · ${new Date(brd.approvedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {statusActions.map((action) => (
            <Button
              key={action.status}
              size="sm"
              variant={action.status === "APPROVED" ? "default" : "outline"}
              disabled={statusBusy}
              onClick={() => void changeStatus(action.status)}
            >
              {action.label}
            </Button>
          ))}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Versi
            <select
              value={selected}
              onChange={(event) => {
                const version = Number(event.target.value);
                setSelected(version);
                if (version === current) onClearDiff();
                else onDiff(version, current);
              }}
              className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            >
              {versions.length === 0 && <option value={current}>v{current}</option>}
              {versions.map((version) => (
                <option key={version.id} value={version.versionNumber}>
                  v{version.versionNumber}
                  {version.versionNumber === current ? " (aktif)" : ""}
                </option>
              ))}
            </select>
          </label>
          {selected !== current && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void onRestore(selected)}
            >
              <RotateCcw size={14} /> {busy ? "Memulihkan…" : "Pulihkan"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void handleExport("markdown")}>
            <Download size={14} /> MD
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void handleExport("pdf")}>
            <FileDown size={14} /> PDF
          </Button>
        </div>
      </div>

      {pending && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <Badge variant="warning">Pratinjau</Badge>
            <span className="truncate text-muted-foreground">
              {brd.pendingChangeSummary ?? "Perubahan menunggu persetujuan"}
            </span>
            {pendingCounts && (
              <span className="font-medium">
                <span className="text-diff-added-foreground">+{pendingCounts.added}</span>{" "}
                <span className="text-diff-removed-foreground">−{pendingCounts.removed}</span>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={approvalBusy} onClick={() => void approve()}>
              <Check size={14} /> {approvalBusy ? "Menyetujui…" : "Setujui"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={approvalBusy}
              onClick={() => void reject()}
            >
              <X size={14} /> Tolak
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border/70 bg-muted/30 px-3 py-1.5">
        <ViewToggle active={view === "document"} onClick={() => setView("document")}>
          Dokumen
        </ViewToggle>
        <ViewToggle active={view === "changes"} onClick={() => setView("changes")}>
          Perubahan
          {pendingCounts && (
            <span className="ml-1 text-[10px]">
              +{pendingCounts.added}/−{pendingCounts.removed}
            </span>
          )}
        </ViewToggle>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {view === "changes" ? (
          <BrdDiffView
            {...(pending
              ? { before: content, after: pending }
              : diff
                ? { diff }
                : { before: content, after: content })}
          />
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <MarkdownContent source={content} colorMode={dark ? "dark" : "light"} />
          </div>
        )}
      </div>
    </section>
  );
}

function statusVariant(status: BrdDocument["status"]): "secondary" | "info" | "success" {
  if (status === "APPROVED") return "success";
  if (status === "IN_REVIEW") return "info";
  return "secondary";
}

function ViewToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-xs"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
