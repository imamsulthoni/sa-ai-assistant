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
  onShowCurrent: () => void;
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
  onShowCurrent,
  onOpen,
  onRestore,
  busy,
}: VersionHistoryProps) {
  // Saat pratinjau versi lama aktif, baris versi terbaru harus tetap bisa
  // diklik untuk kembali menampilkan dokumen aktif.
  const viewingOldVersion = previewVersion != null && previewVersion !== currentVersion;
  if (versions.length === 0) {
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-border bg-card p-5 text-center">
        <FileText size={22} className="mx-auto mb-2 text-muted-foreground" />
        <h3 className="text-xs font-bold text-foreground">
          Belum ada riwayat versi
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Versi tersimpan otomatis setiap kali perubahan disetujui.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">
            Riwayat Versi Dokumen BRD
          </h3>
        </div>
        <span className="rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          Total {versions.length} versi
        </span>
      </div>

      <div className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-px before:bg-muted">
        {versions.map((version) => {
          const active = version.versionNumber === currentVersion;
          const compared = version.versionNumber === compareFrom;
          const previewed = version.versionNumber === previewVersion;
          const fromAgent = version.createdBy === "AI_AGENT";
          return (
            <div key={version.id} className="relative pl-8">
              <span
                className={`absolute top-1.5 left-1.5 -translate-x-1/2 size-4 rounded-full border-2 ${
                  active
                    ? "border-border bg-foreground ring-4 ring-muted"
                    : "border-border bg-card"
                }`}
              />

              <div
                className={`rounded-lg border p-3.5 transition-colors ${
                  active
                    ? "border-border bg-muted"
                    : previewed
                      ? "border-info/30 bg-info/10"
                      : compared
                        ? "border-warning/30 bg-warning/10"
                        : "border-border bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">
                      Versi {version.versionNumber}.0
                    </span>
                    {active ? (
                      <Badge tone="success" className="rounded-md">
                        Versi Aktif
                      </Badge>
                    ) : (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Riwayat
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={13} className="text-muted-foreground" />
                    {relativeTime(version.createdAt)}
                  </span>
                </div>

                <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-muted-foreground">
                    {fromAgent ? (
                      <Bot size={13} className="text-muted-foreground" />
                    ) : (
                      <User size={13} className="text-muted-foreground" />
                    )}
                    {fromAgent ? "AI Agent" : "User"}
                  </span>
                </div>

                {version.changeSummary && (
                  <p className="mt-2 rounded border border-border bg-muted p-2 text-xs leading-relaxed text-muted-foreground">
                    {version.changeSummary}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
                  {active ? (
                    viewingOldVersion ? (
                      <button
                        type="button"
                        onClick={onShowCurrent}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-info transition-colors"
                      >
                        <Eye size={13} />
                        Kembali ke versi aktif
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sedang ditampilkan</span>
                    )
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      {previewed ? (
                        <span className="text-[11px] font-medium text-info">
                          Sedang dipratinjau
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onPreview(version.versionNumber)}
                          className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Eye size={13} />
                          Lihat isi versi ini
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpen(version.versionNumber)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-info transition-colors"
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
