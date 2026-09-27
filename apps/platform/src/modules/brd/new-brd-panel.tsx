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
      <div className="mb-4 flex flex-col justify-between gap-2.5 border-b border-border pb-3.5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">
            {COPY.newBrd.title}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {COPY.newBrd.eyebrow}{" "}
            {onOpenTemplateManager ? (
              <button
                type="button"
                onClick={onOpenTemplateManager}
                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-muted-foreground hover:underline"
              >
                {templateName || COPY.sidebar.noTemplate}
              </button>
            ) : (
              <span className="font-semibold text-muted-foreground">
                {templateName || COPY.sidebar.noTemplate}
              </span>
            )}
          </p>
        </div>

        <div className="inline-flex self-start rounded-md border border-border bg-muted p-0.5 sm:self-auto">
          <button
            type="button"
            onClick={() => setMode("story")}
            className={`cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "story"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {COPY.newBrd.modeStoryTab}
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={`cursor-pointer rounded px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "upload"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {COPY.newBrd.modeUploadTab}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      {mode === "story" ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-xs font-semibold text-foreground">
              {COPY.newBrd.formTitle}
            </span>
          </div>

          {selectableTemplates.length > 1 && onTemplateChange && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {COPY.newBrd.templatePicker}
              </span>
              <select
                value={selectedTemplateId ?? ""}
                disabled={busy}
                onChange={(event) => onTemplateChange(event.target.value)}
                className="w-full rounded-md border border-input bg-card px-2 py-2 text-xs text-foreground transition-colors focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none disabled:opacity-60"
              >
                {selectableTemplates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.sectionCount} section)
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {COPY.newBrd.templatePickerHint}
              </span>
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {COPY.newBrd.userStory} <span className="text-destructive">*</span>
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
            <p className="flex items-start gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
              <AlertCircle size={13} className="mt-px shrink-0" />
              <span>
                {COPY.newBrd.templateRequired}{" "}
                {onOpenTemplateManager && (
                  <button
                    type="button"
                    onClick={onOpenTemplateManager}
                    className="cursor-pointer font-semibold underline underline-offset-2 hover:text-foreground"
                  >
                    {COPY.newBrd.manageTemplate}
                  </button>
                )}
              </span>
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            {reference ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                <Paperclip size={11} /> {reference.name}
                <button
                  type="button"
                  onClick={() => setReference(undefined)}
                  aria-label={`Hapus lampiran ${reference.name}`}
                  className="cursor-pointer text-muted-foreground hover:text-destructive"
                >
                  <X size={11} />
                </button>
              </span>
            ) : (
              <label
                title={COPY.chat.attachTitle(ATTACHMENT_MAX_UPLOAD_LABEL)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
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
          <p className="text-[11px] text-muted-foreground">{COPY.newBrd.clarifyHint}</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-xs font-semibold text-foreground">
              {COPY.newBrd.uploadTitle}
            </span>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center">
            <UploadCloud size={24} className="mx-auto mb-1 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground">
              {brdFile ? brdFile.name : COPY.newBrd.chooseFile}
            </p>
            <label className="mt-2 inline-block cursor-pointer rounded-md border border-input bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:bg-muted">
              {COPY.newBrd.pickFile}
              <input
                type="file"
                className="sr-only"
                accept=".md,.markdown,.docx,.pdf,.txt"
                onChange={(event) => pickBrdFile(event.target.files?.[0])}
              />
            </label>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {COPY.newBrd.uploadHint} · maks {BRD_IMPORT_MAX_UPLOAD_LABEL}
            </p>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-[11px] text-muted-foreground">{COPY.newBrd.uploadFooterHint}</span>
            <div className="flex items-center gap-2">
              {importing && <LoaderCircle size={13} className="animate-spin text-muted-foreground" />}
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
