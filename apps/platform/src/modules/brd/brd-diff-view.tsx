import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  SplitSquareVertical,
  XCircle,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Button } from "#/components/base/button";
import { MarkdownContent } from "#/components/markdown/markdown-content";
import { buildCompactDiff, countDiffChanges, type DiffLine } from "#/lib/diff";

export type CompareTarget = { from: number; to: number; diff: string };

type BrdDiffViewProps = {
  currentVersion: number;
  content: string;
  pending?: string | null;
  pendingSummary?: string | null;
  compare?: CompareTarget | null;
  onApprove?: () => void;
  onReject?: () => void;
  onCloseCompare?: () => void;
  busy?: boolean;
};

type Mode = "changes" | "side" | "full";

function parseDiffString(diff: string): DiffLine[] {
  return diff
    .split("\n")
    .filter((line) => !line.startsWith("--- before") && !line.startsWith("+++ after"))
    .map((line) => {
      if (line.startsWith("+")) return { type: "added", text: line.slice(1) };
      if (line.startsWith("-")) return { type: "removed", text: line.slice(1) };
      return { type: "context", text: line };
    });
}

function DiffLines({ lines }: { lines: DiffLine[] }) {
  const counts = countDiffChanges(lines);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Ringkasan perubahan</span>
        <span className="flex items-center gap-2 font-medium">
          <span className="text-success">+{counts.added} baris</span>
          <span className="text-destructive">−{counts.removed} baris</span>
        </span>
      </div>
      <div className="max-h-[60vh] overflow-auto p-2 font-mono text-[11px] leading-5">
        {lines.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Tidak ada perubahan yang bisa ditampilkan.
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${index}-${line.text}`}
              className={cn(
                "rounded px-1.5 whitespace-pre-wrap",
                line.type === "added" && "bg-diff-added text-diff-added-foreground",
                line.type === "removed" &&
                  "bg-diff-removed text-diff-removed-foreground line-through decoration-diff-removed-foreground",
                line.type === "context" && "text-muted-foreground",
              )}
            >
              {line.segments
                ? line.segments.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={cn(
                        segment.changed &&
                          line.type === "added" &&
                          "font-semibold underline decoration-diff-added-foreground/60",
                        segment.changed &&
                          line.type === "removed" &&
                          "font-semibold decoration-diff-removed-foreground/60",
                      )}
                    >
                      {segment.text}
                    </span>
                  ))
                : line.text || " "}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function BrdDiffView({
  currentVersion,
  content,
  pending,
  pendingSummary,
  compare,
  onApprove,
  onReject,
  onCloseCompare,
  busy,
}: BrdDiffViewProps) {
  const [mode, setMode] = useState<Mode>("changes");

  if (!pending && !compare) {
    return (
      <div className="mx-auto mt-8 max-w-lg rounded-lg border border-border bg-card p-6 text-center">
        <SplitSquareVertical size={26} className="mx-auto mb-2 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground">
          Tidak ada usulan revisi yang menunggu approval
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-[11px] text-muted-foreground">
          Ketik instruksi di chat agen untuk merevisi klausul, atau pilih versi di tab Riwayat untuk
          membandingkan.
        </p>
      </div>
    );
  }

  const nextVersion = currentVersion + 1;
  const lines = pending
    ? buildCompactDiff(content, pending)
    : compare
      ? parseDiffString(compare.diff)
      : [];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-border bg-card p-3.5 shadow-xs">
        {pending ? (
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded bg-warning/10 text-warning">
                <AlertTriangle size={15} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-warning/30 bg-warning/10 px-1.5 py-px text-[10px] font-semibold text-warning">
                    Menunggu Persetujuan (Approval)
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    v{currentVersion}.0 → v{nextVersion}.0
                  </span>
                </div>
                <h3 className="mt-1 text-xs font-bold text-foreground">
                  Usulan Revisi Klausul
                </h3>
                <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                  {pendingSummary ?? "Perubahan menunggu persetujuan Anda."}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onReject?.()}
                className="text-destructive"
              >
                <XCircle size={13} /> Tolak Usulan
              </Button>
              <Button variant="success" disabled={busy} onClick={() => onApprove?.()}>
                <CheckCircle2 size={13} /> Setujui &amp; Buat v{nextVersion}.0
              </Button>
            </div>
          </div>
        ) : (
          compare && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Layers size={14} className="text-muted-foreground" />
                Membandingkan{" "}
                <span className="font-mono font-semibold">
                  v{compare.from}.0 → v{compare.to}.0
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onCloseCompare?.()}>
                Tutup perbandingan
              </Button>
            </div>
          )
        )}

        {pending && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
            <span className="mr-1 text-[11px] font-medium text-muted-foreground">Tampilan Diff:</span>
            <button
              type="button"
              onClick={() => setMode("changes")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-medium transition-colors",
                mode === "changes"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <Layers size={12} /> Per Bagian
            </button>
            <button
              type="button"
              onClick={() => setMode("side")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-medium transition-colors",
                mode === "side"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <SplitSquareVertical size={12} /> Side-by-Side
            </button>
            <button
              type="button"
              onClick={() => setMode("full")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-medium transition-colors",
                mode === "full"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-muted",
              )}
            >
              <FileText size={12} /> Dokumen Penuh
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {mode === "changes" || !pending ? (
          <DiffLines lines={lines} />
        ) : mode === "side" ? (
          <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xs">
              <div className="mb-2 border-b border-border pb-2">
                <span className="text-xs font-bold text-muted-foreground">
                  Versi Saat Ini (v{currentVersion}.0)
                </span>
              </div>
              <MarkdownContent source={content} />
            </div>
            <div className="overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-xs">
              <div className="mb-2 border-b border-border pb-2">
                <span className="text-xs font-bold text-foreground">
                  Usulan Baru (v{nextVersion}.0)
                </span>
              </div>
              <MarkdownContent source={pending ?? ""} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl rounded-lg border border-border bg-card p-5 shadow-xs">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
              <div>
                <span className="rounded border border-border bg-muted px-1.5 py-px text-[10px] font-bold text-muted-foreground">
                  Draft Usulan v{nextVersion}.0
                </span>
                <h4 className="mt-1 text-xs font-bold text-foreground">
                  Pratinjau dokumen jika disetujui
                </h4>
              </div>
              <Button variant="success" size="sm" disabled={busy} onClick={() => onApprove?.()}>
                <CheckCircle2 size={12} /> Approve Versi Ini
              </Button>
            </div>
            <MarkdownContent source={pending ?? ""} />
          </div>
        )}
      </div>
    </div>
  );
}
