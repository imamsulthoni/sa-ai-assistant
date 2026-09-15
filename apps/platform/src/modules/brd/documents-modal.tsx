import { useRef, useState } from "react";
import { AtSign, Eye, FileText, LoaderCircle, Plus, Trash2, UploadCloud } from "lucide-react";
import { cn } from "#/lib/utils";
import { Badge, type BadgeTone } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { Modal } from "#/components/base/modal";
import type { DocumentSummary } from "#/lib/api";
import { COPY, formatBytes, statusLabel } from "#/lib/copy";
import { relativeTime } from "#/lib/time";
import { MAX_UPLOAD_LABEL } from "#/lib/upload";

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
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
              if (event.dataTransfer.files?.length) onUpload(event.dataTransfer.files);
            }}
            className={cn(
              "rounded-lg border border-dashed p-4 text-center transition-colors",
              dragging
                ? "border-slate-800 bg-slate-100 dark:border-slate-200 dark:bg-slate-800"
                : "border-slate-300 bg-slate-50/60 dark:border-slate-700 dark:bg-slate-950/40",
            )}
          >
            <UploadCloud size={20} className="mx-auto mb-1 text-slate-400" />
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {COPY.documents.dropTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {COPY.documents.dropHint(MAX_UPLOAD_LABEL)}
            </p>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              {uploading ? <LoaderCircle size={12} className="animate-spin" /> : <Plus size={12} />}
              <span>{uploading ? COPY.documents.uploading : COPY.documents.choose}</span>
              <input
                ref={inputRef}
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

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="space-y-2">
            <h4 className="text-xs font-bold tracking-wider text-slate-600 uppercase dark:text-slate-400">
              {COPY.documents.listTitle(documents.length)}
            </h4>

            {loading && (
              <p className="py-3 text-center text-xs text-slate-400">{COPY.sidebar.loadingFiles}</p>
            )}

            {!loading && documents.length === 0 && (
              <p className="py-3 text-center text-xs text-slate-400">{COPY.documents.empty}</p>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {documents.map((document) => {
                const transient =
                  document.status === "UPLOADING" || document.status === "PROCESSING";
                return (
                  <div
                    key={document.id}
                    className="flex flex-col justify-between space-y-2 rounded-md border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <FileText size={14} className="shrink-0 text-slate-400" />
                          <h5
                            className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100"
                            title={document.title}
                          >
                            {document.title}
                          </h5>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-slate-400">
                          {formatBytes(document.fileSize)}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(document.status)}>
                          {transient && <LoaderCircle size={9} className="animate-spin" />}
                          {statusLabel(document.status)}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {relativeTime(document.createdAt)}
                        </span>
                      </div>

                      {document.error && (
                        <p className="mt-1.5 line-clamp-2 text-[11px] text-rose-600 dark:text-rose-400">
                          {document.error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs dark:border-slate-800">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={!document.storageUrl}
                          onClick={() =>
                            document.storageUrl &&
                            window.open(document.storageUrl, "_blank", "noopener,noreferrer")
                          }
                          className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Eye size={11} /> Pratinjau
                        </button>
                        <button
                          type="button"
                          onClick={() => onMention(document)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-800 transition-colors hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <AtSign size={11} /> Mention
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(document)}
                        title={COPY.sidebar.delete}
                        aria-label={`${COPY.sidebar.delete} ${document.title}`}
                        className="cursor-pointer p-1 text-slate-400 transition-colors hover:text-rose-500"
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
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
          {COPY.sidebar.deleteDocumentDescription(deleteTarget?.title ?? "")}
        </p>
      </Modal>
    </>
  );
}
