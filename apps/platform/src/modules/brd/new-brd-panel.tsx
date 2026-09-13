import { useState } from "react";
import { FileText, FileUp, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { Button } from "#/components/ui/button";

type NewBrdPanelProps = {
  onGenerate: (story: string, file?: File) => void;
  onImport: (file: File) => void;
  busy?: boolean;
  importing?: boolean;
};

type Mode = "story" | "existing";

export function NewBrdPanel({ onGenerate, onImport, busy, importing }: NewBrdPanelProps) {
  const [mode, setMode] = useState<Mode>("story");
  const [story, setStory] = useState("");
  const [file, setFile] = useState<File>();
  const [brdFile, setBrdFile] = useState<File>();

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-12 sm:py-16">
      <div>
        <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-neutral-900 text-white">
          <Sparkles size={20} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          New workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Start a BRD workspace.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Generate a new BRD from a user story, or import an existing BRD document to review and
          refine it with the assistant.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setMode("story")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "story" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles size={15} />
          From user story
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            mode === "existing" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileUp size={15} />
          I already have a BRD
        </button>
      </div>

      {mode === "story" ? (
        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          <label className="mb-2 block text-sm font-medium" htmlFor="user-story">
            User story or stakeholder brief
          </label>
          <textarea
            id="user-story"
            value={story}
            onChange={(event) => setStory(event.target.value)}
            placeholder="As a customer, I want…"
            className="min-h-40 w-full resize-y rounded-xl border bg-background p-3 text-sm leading-6 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent">
              <Upload size={14} />
              {file ? file.name : "Attach reference"}
              <input
                type="file"
                className="sr-only"
                accept=".md,.pdf,.docx"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
            <Button disabled={!story.trim() || busy} onClick={() => onGenerate(story.trim(), file)}>
              {busy ? <LoaderCircle size={16} className="animate-spin" /> : <FileText size={16} />}
              {busy ? "Preparing clarification…" : "Generate BRD"}
            </Button>
          </div>
          {file && (
            <p className="mt-2 text-xs text-muted-foreground">
              The reference document will be indexed and used as grounding context.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-4 shadow-sm md:p-5">
          <p className="text-sm font-medium">Existing BRD document</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Supported formats: Markdown, DOCX, or PDF. The document is processed, stored in this
            session's files, and imported as BRD v1 so you can ask questions or request
            modifications in chat.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-accent">
              <Upload size={14} />
              {brdFile ? brdFile.name : "Choose BRD file"}
              <input
                type="file"
                className="sr-only"
                accept=".md,.markdown,.docx,.pdf"
                onChange={(event) => setBrdFile(event.target.files?.[0])}
              />
            </label>
            <Button disabled={!brdFile || importing} onClick={() => brdFile && onImport(brdFile)}>
              {importing ? <LoaderCircle size={16} className="animate-spin" /> : <FileUp size={16} />}
              {importing ? "Processing document…" : "Import BRD"}
            </Button>
          </div>
          {importing && (
            <p className="mt-2 text-xs text-muted-foreground">
              Extracting text and indexing the document. This can take a moment for scanned PDFs.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
