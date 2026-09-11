import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Download, FileDown, Save } from "lucide-react";
import { Button } from "#/components/ui/button";
import { exportBrd, modifyBrd, type BrdDocument } from "#/lib/api";

type DocumentPaneProps = {
  brd: BrdDocument;
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
  busy?: boolean;
  onChangeRequest?: (markdown: string, summary: string) => void;
};

export function DocumentPane({
  brd,
  content,
  onChange,
  onSave,
  busy,
  onChangeRequest,
}: DocumentPaneProps) {
  const [dark, setDark] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [modifying, setModifying] = useState(false);

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
      <div className="flex gap-2 border-b px-4 py-2">
        <input
          value={changeRequest}
          onChange={(event) => setChangeRequest(event.target.value)}
          placeholder="Request an AI change, e.g. add FR-003..."
          className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={modifying || !changeRequest.trim()}
          onClick={async () => {
            setModifying(true);
            try {
              const result = await modifyBrd({ brd: content, changeRequest });
              onChangeRequest?.(result.updatedMarkdown, result.changeSummary);
              setChangeRequest("");
            } finally {
              setModifying(false);
            }
          }}
        >
          {modifying ? "Reviewing…" : "Review AI Change"}
        </Button>
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
