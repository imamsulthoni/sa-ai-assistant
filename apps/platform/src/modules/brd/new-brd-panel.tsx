import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  FileUp,
  LoaderCircle,
  Paperclip,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "#/components/base/button";
import { Textarea } from "#/components/base/input";
import { COPY } from "#/lib/copy";
import type { TemplateSummary } from "#/lib/api";
import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  ATTACHMENT_MAX_UPLOAD_LABEL,
  BRD_IMPORT_MAX_UPLOAD_BYTES,
  BRD_IMPORT_MAX_UPLOAD_LABEL,
} from "#/lib/upload";

type NewBrdPanelProps = {
  onGenerate: (story: string, file?: File) => void;
  onImport: (file: File) => void;
  busy?: boolean;
  importing?: boolean;
  templateName?: string | null;
  templateReady?: boolean;
  onOpenTemplateManager?: () => void;
  onModeChange?: (mode: NewBrdMode) => void;
  initialStory?: string;
  /** Template siap pakai; dropdown muncul bila lebih dari satu. */
  templates?: TemplateSummary[];
  selectedTemplateId?: string | null;
  onTemplateChange?: (id: string) => void;
};

export type NewBrdMode = "story" | "upload";

export function NewBrdPanel({
  onGenerate,
  onImport,
  busy,
  importing,
  templateName,
  templateReady = true,
  onOpenTemplateManager,
  onModeChange,
  initialStory,
  templates = [],
  selectedTemplateId,
  onTemplateChange,
}: NewBrdPanelProps) {
  const selectableTemplates = templates.filter(
    (item) => item.status === "READY" && item.hasStructure,
  );
  const [mode, setModeState] = useState<NewBrdMode>("story");
  const setMode = (next: NewBrdMode) => {
    setModeState(next);
    onModeChange?.(next);
  };
  const [story, setStory] = useState("");
  const [reference, setReference] = useState<File>();
  const [brdFile, setBrdFile] = useState<File>();
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const appliedStory = useRef("");

  useEffect(() => {
    const text = initialStory?.trim() ?? "";
    if (!text || text === appliedStory.current) return;
    appliedStory.current = text;
    setStory(text);
  }, [initialStory]);

  const submitStory = () => {
    const text = story.trim();
    if (!text) {
      setError(COPY.newBrd.validation);
      return;
    }
    if (!templateReady) {
      setError(COPY.newBrd.templateRequired);
      return;
    }
    setError(null);
    appliedStory.current = text;
    onGenerate(text, reference);
  };

  const pickReference = (file: File | undefined) => {
    if (!file) return;
    if (file.size > ATTACHMENT_MAX_UPLOAD_BYTES) {
      setError(COPY.errors.attachmentTooLarge(file.name, ATTACHMENT_MAX_UPLOAD_LABEL));
      return;
    }
    setError(null);
    setReference(file);
  };

  const pickBrdFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > BRD_IMPORT_MAX_UPLOAD_BYTES) {
      setError(COPY.errors.brdImportTooLarge(file.name, BRD_IMPORT_MAX_UPLOAD_LABEL));
      return;
    }
    setError(null);
    setBrdFile(file);
  };

  const submitPaste = () => {
    const text = pasteText.trim();
    if (!text) {
      setError(COPY.newBrd.pasteRequired);
      return;
    }
    setError(null);
    onImport(new File([text], "Dokumen_Tempelan.md", { type: "text/markdown" }));
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-4">
      <div className="mb-4 flex flex-col justify-between gap-2.5 border-b border-slate-200 pb-3.5 sm:flex-row sm:items-center dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {COPY.newBrd.title}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {COPY.newBrd.eyebrow}{" "}
            {onOpenTemplateManager ? (
              <button
                type="button"
                onClick={onOpenTemplateManager}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-700 hover:underline dark:text-slate-300"
              >
                {templateName || COPY.sidebar.noTemplate}
              </button>
            ) : (
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {templateName || COPY.sidebar.noTemplate}
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex self-start rounded-md border border-slate-200 bg-slate-100 p-0.5 sm:self-auto dark:border-slate-700 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode("story")}
            className={`cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "story"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {COPY.newBrd.modeStoryTab}
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "upload"
                ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {COPY.newBrd.modeUploadTab}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      {mode === "story" ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {COPY.newBrd.formTitle}
            </span>
          </div>

          {selectableTemplates.length > 1 && onTemplateChange && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                {COPY.newBrd.templatePicker}
              </span>
              <select
                value={selectedTemplateId ?? ""}
                disabled={busy}
                onChange={(event) => onTemplateChange(event.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-900 transition-colors focus:border-slate-500 focus:ring-1 focus:ring-slate-500 focus:outline-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                {selectableTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.sectionCount} section)
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">
                {COPY.newBrd.templatePickerHint}
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {COPY.newBrd.userStory} <span className="text-rose-500">*</span>
            </span>
            <Textarea
              rows={6}
              value={story}
              onChange={(event) => setStory(event.target.value)}
              placeholder={
                "Sebagai [pengguna], saya ingin [tindakan], sehingga [manfaat bisnis]…\n\nSertakan juga tujuan bisnis, target pengguna, dan batasan bila ada."
              }
            />
          </label>

          {!templateReady && (
            <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertCircle size={13} className="mt-px shrink-0" />
              <span>
                {COPY.newBrd.templateRequired}{" "}
                {onOpenTemplateManager && (
                  <button
                    type="button"
                    onClick={onOpenTemplateManager}
                    className="cursor-pointer font-semibold underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
                  >
                    {COPY.newBrd.manageTemplate}
                  </button>
                )}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            {reference ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Paperclip size={11} /> {reference.name}
                <button
                  type="button"
                  onClick={() => setReference(undefined)}
                  aria-label={`Hapus lampiran ${reference.name}`}
                  className="cursor-pointer text-slate-400 hover:text-rose-500"
                >
                  <X size={11} />
                </button>
              </span>
            ) : (
              <label
                title={COPY.chat.attachTitle(ATTACHMENT_MAX_UPLOAD_LABEL)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                <Paperclip size={12} /> {COPY.newBrd.attach}
                <input
                  type="file"
                  className="sr-only"
                  accept=".md,.pdf,.docx"
                  onChange={(event) => pickReference(event.target.files?.[0])}
                />
              </label>
            )}

            <Button disabled={busy || !templateReady} onClick={submitStory}>
              {busy ? <LoaderCircle size={13} className="animate-spin" /> : null}
              {COPY.newBrd.startClarify} <ArrowRight size={13} />
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">{COPY.newBrd.clarifyHint}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {COPY.newBrd.uploadTitle}
            </span>
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4 text-center dark:border-slate-700 dark:bg-slate-950/40">
            <UploadCloud size={24} className="mx-auto mb-1 text-slate-400" />
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {brdFile ? brdFile.name : COPY.newBrd.chooseFile}
            </p>
            <label className="mt-2 inline-block cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              {COPY.newBrd.pickFile}
              <input
                type="file"
                className="sr-only"
                accept=".md,.markdown,.docx,.pdf,.txt"
                onChange={(event) => pickBrdFile(event.target.files?.[0])}
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-400">
              {COPY.newBrd.uploadHint} · maks {BRD_IMPORT_MAX_UPLOAD_LABEL}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {COPY.newBrd.pasteLabel}
            </span>
            <Textarea
              rows={5}
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="Tempel teks spesifikasi atau draft kebutuhan bisnis di sini…"
              className="font-mono"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-[11px] text-slate-400">{COPY.newBrd.uploadFooterHint}</span>
            <div className="flex items-center gap-2">
              {importing && <LoaderCircle size={13} className="animate-spin text-slate-400" />}
              <Button
                variant="outline"
                disabled={importing || !brdFile}
                onClick={() => brdFile && onImport(brdFile)}
              >
                <FileUp size={13} /> {importing ? COPY.newBrd.importing : COPY.newBrd.import}
              </Button>
              <Button disabled={importing} onClick={submitPaste}>
                {COPY.newBrd.restructure} <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
