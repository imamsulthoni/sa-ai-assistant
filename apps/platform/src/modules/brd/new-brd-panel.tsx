import { useState } from "react";
import { FileText, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { Button } from "#/components/ui/button";

type NewBrdPanelProps = {
  onGenerate: (story: string, file?: File) => void;
  busy?: boolean;
};

export function NewBrdPanel({ onGenerate, busy }: NewBrdPanelProps) {
  const [story, setStory] = useState("");
  const [file, setFile] = useState<File>();

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-12 sm:py-16">
      <div>
        <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-neutral-900 text-white">
          <Sparkles size={20} />
        </div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          New workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Turn a user story into a BRD.</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          Start with the business context. The assistant will surface ambiguity before drafting a
          structured specification — max 2 rounds of questions.
        </p>
      </div>
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
    </section>
  );
}