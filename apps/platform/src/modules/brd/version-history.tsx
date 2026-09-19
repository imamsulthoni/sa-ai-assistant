import { ArrowRight, Bot, Clock, Eye, FileText, RotateCcw, User } from "lucide-react";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import type { BrdVersion } from "#/lib/api";
import { relativeTime } from "#/lib/time";

type VersionHistoryProps = {
  versions: BrdVersion[];
  currentVersion: number;
  compareFrom?: number | null;
  previewVersion?: number | null;
  onPreview: (version: number) => void;
  onOpen: (version: number) => void;
  onRestore: (version: number) => void;
  busy?: boolean;
};

export function VersionHistory({
  versions,
  currentVersion,
  compareFrom,
  previewVersion,
  onPreview,
  onOpen,
  onRestore,
  busy,
}: VersionHistoryProps) {
  if (versions.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5 text-center dark:border-slate-800 dark:bg-slate-900">
        <FileText size={22} className="mx-auto mb-2 text-slate-400" />
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Belum ada riwayat versi
        </h3>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Versi tersimpan otomatis setiap kali perubahan disetujui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Riwayat Versi Dokumen BRD
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Total {versions.length} versi
        </span>
      </div>

      <div className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-slate-200 dark:before:bg-slate-800">
        {versions.map((version) => {
          const active = version.versionNumber === currentVersion;
          const compared = version.versionNumber === compareFrom;
          const previewed = version.versionNumber === previewVersion;
          const fromAgent = version.createdBy === "AI_AGENT";
          return (
            <div key={version.id} className="relative pl-8">
              <span
                className={`absolute top-1.5 left-1.5 size-4 -translate-x-1/2 rounded-full border-2 ${
                  active
                    ? "border-slate-300 bg-slate-900 ring-4 ring-slate-100 dark:border-slate-600 dark:bg-slate-100 dark:ring-slate-800"
                    : "border-slate-400 bg-white dark:bg-slate-900"
                }`}
              />

              <div
                className={`rounded-lg border p-3.5 transition-colors ${
                  active
                    ? "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"
                    : previewed
                      ? "border-sky-300 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30"
                      : compared
                        ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      Versi {version.versionNumber}.0
                    </span>
                    {active ? (
                      <Badge tone="success" className="rounded-full">
                        Versi Aktif
                      </Badge>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        Riwayat
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Clock size={13} className="text-slate-400" />
                    {relativeTime(version.createdAt)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                    {fromAgent ? (
                      <Bot size={13} className="text-slate-500" />
                    ) : (
                      <User size={13} className="text-slate-500" />
                    )}
                    {fromAgent ? "AI Agent" : "User"}
                  </span>
                </div>

                {version.changeSummary && (
                  <p className="mt-2 rounded border border-slate-100 bg-slate-50 p-2 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                    {version.changeSummary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                  {active ? (
                    <span className="text-[11px] text-slate-400">Sedang ditampilkan</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {previewed ? (
                        <span className="text-[11px] font-medium text-sky-700 dark:text-sky-400">
                          Sedang dipratinjau
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPreview(version.versionNumber)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100"
                        >
                          <Eye size={13} />
                          Lihat isi versi ini
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen(version.versionNumber)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-sky-700 transition-colors hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
                      >
                        <FileText size={13} />
                        Bandingkan <ArrowRight size={12} />
                      </button>
                    </div>
                  )}

                  {!active && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRestore(version.versionNumber)}
                    >
                      <RotateCcw size={12} /> Pulihkan Versi Ini
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
