import { useCallback, useEffect, useRef, useState } from "react";
import {
  AtSign,
  Eye,
  FileText,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Badge, type BadgeTone } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Modal } from "#/components/base/modal";
import type { DocumentSummary } from "#/lib/api";
import { COPY, formatBytes, statusLabel } from "#/lib/copy";
import { relativeTime } from "#/lib/time";
import { ATTACHMENT_MAX_UPLOAD_LABEL } from "#/lib/upload";

type DocumentsModalProps = {
  open: boolean;
  onClose: () => void;
  documents: DocumentSummary[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  onUpload: (files: FileList) => void;
  onDelete: (id: string) => void;
  onMention: (document: DocumentSummary) => void;
};

function statusTone(status: DocumentSummary["status"]): BadgeTone {
  if (status === "READY") return "success";
  if (status === "FAILED") return "danger";
  if (status === "PENDING_CONFIRMATION") return "warning";
  return "neutral";
}

export function DocumentsModal({
  open,
  onClose,
  documents,
  loading,
  uploading,
  error,
  onUpload,
  onDelete,
  onMention,
}: DocumentsModalProps) {
  const [dragging, setDragging] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(
    null,
  );
  const [pending, setPending] = useState<
    Array<{ key: string; name: string; size: number }>
  >([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingKey = useRef(0);

  // Tambahkan item "sedang diunggah" segera setelah file dipilih agar ada
  // umpan balik visual langsung, lalu hapus setelah dokumen dari server muncul.
  const handleUpload = useCallback(
    (files: FileList) => {
      const items = Array.from(files).map((file) => ({
        key: `pending-${++pendingKey.current}`,
        name: file.name,
        size: file.size,
      }));
      setPending((prev) => [...prev, ...items]);
      onUpload(files);
    },
    [onUpload],
  );

  useEffect(() => {
    if (pending.length === 0) return;
    const titles = new Set(documents.map((document) => document.title));
    setPending((prev) => prev.filter((item) => !titles.has(item.name)));
  }, [documents, pending.length]);

  // Jika upload gagal, bersihkan item pending agar tidak tertahan.
  useEffect(() => {
    if (error) setPending([]);
  }, [error]);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={COPY.documents.title}
        description={COPY.documents.description(documents.length)}
        footer={<Button onClick={onClose}>{COPY.documents.done}</Button>}
      >
        <div className="space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (event.dataTransfer.files?.length)
                handleUpload(event.dataTransfer.files);
            }}
            className={cn(
              "rounded-lg border border-dashed p-4 text-center transition-colors",
              dragging ? "border-foreground bg-muted" : "border-input bg-muted",
            )}
          >
            <UploadCloud
              size={20}
              className="mx-auto mb-1 text-muted-foreground"
            />
            <p className="text-xs font-semibold text-foreground">
              {COPY.documents.dropTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {COPY.documents.dropHint(ATTACHMENT_MAX_UPLOAD_LABEL)}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded border border-input bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-70"
            >
              {uploading ? (
                <LoaderCircle size={12} className="animate-spin" />
              ) : (
                <Plus size={12} />
              )}
              <span>
                {uploading ? COPY.documents.uploading : COPY.documents.choose}
              </span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              tabIndex={-1}
              className="sr-only"
              accept=".pdf,.md,.markdown,.docx,.png,.jpg,.jpeg,.webp,.tiff"
              disabled={uploading}
              onChange={(event) => {
                if (event.currentTarget.files?.length)
                  handleUpload(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-2">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              {COPY.documents.listTitle(documents.length)}
            </h4>

            {loading && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {COPY.sidebar.loadingFiles}
              </p>
            )}

            {!loading && documents.length === 0 && (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {COPY.documents.empty}
              </p>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {pending.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-col justify-between space-y-2 rounded-md border border-border bg-card p-3 opacity-80"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <FileText
                          size={14}
                          className="shrink-0 text-muted-foreground"
                        />
                        <h5
                          className="truncate text-xs font-semibold text-foreground"
                          title={item.name}
                        >
                          {item.name}
                        </h5>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {formatBytes(item.size)}
                      </span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge tone="neutral">
                        <LoaderCircle
                          size={9}
                          className="animate-spin"
                        />
                        {COPY.documents.uploading}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}

              {documents.map((document) => {
                const transient =
                  document.status === "UPLOADING" ||
                  document.status === "PROCESSING";
                return (
                  <div
                    key={document.id}
                    className="flex flex-col justify-between space-y-2 rounded-md border border-border bg-card p-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <FileText
                            size={14}
                            className="shrink-0 text-muted-foreground"
                          />
                          <h5
                            className="truncate text-xs font-semibold text-foreground"
                            title={document.title}
                          >
                            {document.title}
                          </h5>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatBytes(document.fileSize)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(document.status)}>
                          {transient && (
                            <LoaderCircle size={9} className="animate-spin" />
                          )}
                          {statusLabel(document.status)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeTime(document.createdAt)}
                        </span>
                      </div>

                      {document.error && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-destructive">
                          {document.error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-border pt-2 text-xs">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!document.storageUrl}
                          onClick={() =>
                            document.storageUrl &&
                            window.open(
                              document.storageUrl,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-40"
                        >
                          <Eye size={11} /> Pratinjau
                        </button>
                        <button
                          type="button"
                          onClick={() => onMention(document)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors"
                        >
                          <AtSign size={11} /> Mention
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(document)}
                        title={COPY.sidebar.delete}
                        aria-label={`${COPY.sidebar.delete} ${document.title}`}
                        className="cursor-pointer p-1 text-muted-foreground transition-colors hover:text-destructive"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={COPY.sidebar.deleteDocumentTitle}
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
              {COPY.sidebar.deleteDocumentConfirm}
            </Button>
          </>
        }
      >
        <p className="text-xs leading-5 text-muted-foreground">
          {COPY.sidebar.deleteDocumentDescription(deleteTarget?.title ?? "")}
        </p>
      </Modal>
    </>
  );
}
