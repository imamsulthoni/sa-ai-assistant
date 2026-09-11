import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Download, FileDown, Save } from "lucide-react";
import { Button } from "#/components/ui/button";
import { exportBrd, type BrdDocument } from "#/lib/api";

type DocumentPaneProps = {
  brd: BrdDocument;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  busy?: boolean;
};

export function DocumentPane({ brd, content, onChange, onSave, busy }: DocumentPaneProps) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col bg-background"
      data-color-mode={dark ? "dark" : "light"}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Document pane
          </p>
          <h2 className="font-semibold">{brd.title}</h2>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={busy} onClick={onSave}>
            <Save size={14} /> {busy ? "Saving…" : "Save Version"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void exportBrd(brd.id, "markdown")}>
            <Download size={14} /> MD
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void exportBrd(brd.id, "pdf")}>
            <FileDown size={14} /> PDF
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <MDEditor
          value={content}
          onChange={(value) => onChange(value ?? "")}
          height={480}
          preview="live"
        />
      </div>
    </section>
  );
}
