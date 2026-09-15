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
import { Input, Textarea } from "#/components/base/input";
import { COPY } from "#/lib/copy";
import {
  composeUserStory,
  EMPTY_STORY_FIELDS,
  parseUserStory,
  type BrdStoryFields,
} from "#/lib/story-input";

type NewBrdPanelProps = {
  onGenerate: (story: string, file?: File) => void;
  onImport: (file: File) => void;
  busy?: boolean;
  importing?: boolean;
  templateName?: string | null;
  onOpenTemplateManager?: () => void;
  initialStory?: string;
};

type Mode = "story" | "upload";

const PRESET: BrdStoryFields = {
  featureName: "Open Finance API Account Aggregation & Consent Engine",
  userStory:
    "Sebagai nasabah multi-bank, saya ingin menghubungkan rekening bank pihak ketiga via OAuth SNAP BI, agar mutasi dan saldo agregat terpantau real-time dalam satu aplikasi.",
  businessObjective:
    "Konsolidasi multi-rekening perbankan ke satu dashboard standar SNAP BI dengan target 200k nasabah aktif.",
  targetUsers: "Nasabah ritel, wealth management, audit risk officer.",
  acceptanceCriteria:
    "Linking < 45 detik; masa berlaku token 90 hari; auto-revoke saat device tampering.",
  technicalConstraints:
    "Standar SNAP Bank Indonesia; enkripsi AES-256; autentikasi mTLS dengan sertifikat perbankan.",
};

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function NewBrdPanel({
  onGenerate,
  onImport,
  busy,
  importing,
  templateName,
  onOpenTemplateManager,
  initialStory,
}: NewBrdPanelProps) {
  const [mode, setMode] = useState<Mode>("story");
  const [fields, setFields] = useState<BrdStoryFields>(EMPTY_STORY_FIELDS);
  const [reference, setReference] = useState<File>();
  const [brdFile, setBrdFile] = useState<File>();
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const appliedStory = useRef("");

  useEffect(() => {
    const story = initialStory?.trim() ?? "";
    if (!story || story === appliedStory.current) return;
    appliedStory.current = story;
    setFields(parseUserStory(story));
  }, [initialStory]);

  const update = (key: keyof BrdStoryFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const submitStory = () => {
    if (!fields.featureName.trim() || !fields.userStory.trim()) {
      setError(COPY.newBrd.validation);
      return;
    }
    setError(null);
    appliedStory.current = composeUserStory(fields);
    onGenerate(appliedStory.current, reference);
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
            <button
              type="button"
              onClick={() => setFields(PRESET)}
              className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {COPY.newBrd.fillSample}
            </button>
          </div>

          <Field
            label={COPY.newBrd.featureName}
            required
            value={fields.featureName}
            onChange={(value) => update("featureName", value)}
            placeholder="Contoh: Open Finance API Account Aggregation"
          />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
              {COPY.newBrd.userStory} <span className="text-rose-500">*</span>
            </span>
            <Textarea
              rows={2}
              value={fields.userStory}
              onChange={(event) => update("userStory", event.target.value)}
              placeholder="Sebagai [pengguna], saya ingin [tindakan], sehingga [manfaat bisnis]…"
            />
          </label>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field
              label={COPY.newBrd.businessObjective}
              value={fields.businessObjective}
              onChange={(value) => update("businessObjective", value)}
              placeholder="Target efisiensi / peningkatan volume"
            />
            <Field
              label={COPY.newBrd.targetUsers}
              value={fields.targetUsers}
              onChange={(value) => update("targetUsers", value)}
              placeholder="Nasabah ritel, staf operasional"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Field
              label={COPY.newBrd.acceptanceCriteria}
              value={fields.acceptanceCriteria}
              onChange={(value) => update("acceptanceCriteria", value)}
              placeholder="Misal: waktu linking < 45 detik"
            />
            <Field
              label={COPY.newBrd.technicalConstraints}
              value={fields.technicalConstraints}
              onChange={(value) => update("technicalConstraints", value)}
              placeholder="Misal: Standar SNAP BI, mTLS"
            />
          </div>

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
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
                <Paperclip size={12} /> {COPY.newBrd.attach}
                <input
                  type="file"
                  className="sr-only"
                  accept=".md,.pdf,.docx"
                  onChange={(event) => setReference(event.target.files?.[0])}
                />
              </label>
            )}

            <Button disabled={busy} onClick={submitStory}>
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
                onChange={(event) => setBrdFile(event.target.files?.[0])}
              />
            </label>
            <p className="mt-1 text-[11px] text-slate-400">{COPY.newBrd.uploadHint}</p>
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
