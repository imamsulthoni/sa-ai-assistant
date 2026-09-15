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
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/50">
        <span className="font-medium text-slate-500 dark:text-slate-400">Ringkasan perubahan</span>
        <span className="flex items-center gap-2 font-medium">
          <span className="text-emerald-700 dark:text-emerald-400">+{counts.added} baris</span>
          <span className="text-rose-700 dark:text-rose-400">−{counts.removed} baris</span>
        </span>
      </div>
      <div className="max-h-[60vh] overflow-auto p-2 font-mono text-[11px] leading-5">
        {lines.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">
            Tidak ada perubahan yang bisa ditampilkan.
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${index}-${line.text}`}
              className={cn(
                "rounded px-1.5 whitespace-pre-wrap",
                line.type === "added" &&
                  "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
                line.type === "removed" &&
                  "bg-rose-50 text-rose-900 line-through decoration-rose-400 dark:bg-rose-950/50 dark:text-rose-200",
                line.type === "context" && "text-slate-500 dark:text-slate-400",
              )}
            >
              {line.segments
                ? line.segments.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={cn(
                        segment.changed &&
                          line.type === "added" &&
                          "font-semibold underline decoration-emerald-500/60",
                        segment.changed &&
                          line.type === "removed" &&
                          "font-semibold decoration-rose-500/60",
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
      <div className="mx-auto mt-8 max-w-lg rounded-lg border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <SplitSquareVertical size={26} className="mx-auto mb-2 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Tidak ada usulan revisi yang menunggu approval
        </h3>
        <p className="mx-auto mt-1 max-w-sm text-[11px] text-slate-500 dark:text-slate-400">
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
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        {pending ? (
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle size={15} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                    Menunggu Persetujuan (Approval)
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    v{currentVersion}.0 → v{nextVersion}.0
                  </span>
                </div>
                <h3 className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                  Usulan Revisi Klausul
                </h3>
                <p className="mt-0.5 max-w-xl text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {pendingSummary ?? "Perubahan menunggu persetujuan Anda."}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end md:self-center">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onReject?.()}
                className="text-rose-700 dark:text-rose-300"
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
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <Layers size={14} className="text-slate-400" />
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
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-2.5 dark:border-slate-800">
            <span className="mr-1 text-[11px] font-medium text-slate-400">Tampilan Diff:</span>
            <button
              type="button"
              onClick={() => setMode("changes")}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded border px-2.5 py-0.5 text-xs font-medium transition-colors",
                mode === "changes"
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
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
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
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
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
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
            <div className="overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Versi Saat Ini (v{currentVersion}.0)
                </span>
              </div>
              <MarkdownContent source={content} />
            </div>
            <div className="overflow-y-auto rounded-lg border border-slate-300 bg-white p-3 shadow-xs dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Usulan Baru (v{nextVersion}.0)
                </span>
              </div>
              <MarkdownContent source={pending ?? ""} />
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
              <div>
                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-px text-[10px] font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Draft Usulan v{nextVersion}.0
                </span>
                <h4 className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
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
