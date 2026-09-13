import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Check, Download, FileDown, RotateCcw, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { approveBrdModification, exportBrd, rejectBrdModification, type BrdDocument } from "#/lib/api";

type DocumentPaneProps = {
  brd: BrdDocument;
  content: string;
  diff: string | null;
  onDiff: (from: number, to: number) => void;
  onRestore: (version: number) => void;
  onClearDiff: () => void;
  onApproved: (brd: BrdDocument) => void;
  busy?: boolean;
};

export function DocumentPane({ brd, content, diff, onDiff, onRestore, onClearDiff, onApproved, busy }: DocumentPaneProps) {
  const [dark, setDark] = useState(false);
  const [selected, setSelected] = useState(brd.currentVersion);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const versions = brd.versions ?? [];

  useEffect(() => { setDark(document.documentElement.classList.contains("dark")); }, []);
  useEffect(() => { setSelected(brd.currentVersion); onClearDiff(); }, [brd.id, brd.currentVersion, onClearDiff]);

  const current = brd.currentVersion;
  const diffLines = diff?.split("\n") ?? [];
  const approve = async () => {
    setApprovalBusy(true);
    try { const result = await approveBrdModification(brd.id); onApproved(result.brd); }
    finally { setApprovalBusy(false); }
  };
  const reject = async () => {
    setApprovalBusy(true);
    try { await rejectBrdModification(brd.id); onApproved({ ...brd, pendingContentMarkdown: null, pendingChangeSummary: null }); }
    finally { setApprovalBusy(false); }
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background" data-color-mode={dark ? "dark" : "light"}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">BRD</p><h2 className="font-semibold">{brd.title}</h2></div>
        <div className="flex flex-wrap items-center gap-1">
          {brd.pendingContentMarkdown && <div className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 dark:bg-amber-950/30"><span className="text-xs text-amber-800 dark:text-amber-200">Pending modification</span><Button size="sm" disabled={approvalBusy} onClick={() => void approve()}><Check size={14} /> {approvalBusy ? "Approving…" : "Approve"}</Button><Button size="sm" variant="outline" disabled={approvalBusy} onClick={() => void reject()}>Reject</Button></div>}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">Version<select value={selected} onChange={(event) => { const version = Number(event.target.value); setSelected(version); if (version === current) onClearDiff(); else onDiff(version, current); }} className="h-8 rounded-md border bg-background px-2 text-sm">{versions.length === 0 && <option value={current}>v{current}</option>}{versions.map((version) => <option key={version.id} value={version.versionNumber}>v{version.versionNumber}{version.versionNumber === current ? " (active)" : ""}</option>)}</select></label>
          {selected !== current && <Button size="sm" variant="outline" disabled={busy} onClick={() => void onRestore(selected)}><RotateCcw size={14} /> {busy ? "Restoring…" : "Restore"}</Button>}
          <Button size="sm" variant="ghost" onClick={() => void exportBrd(brd.id, "markdown")}><Download size={14} /> MD</Button><Button size="sm" variant="ghost" onClick={() => void exportBrd(brd.id, "pdf")}><FileDown size={14} /> PDF</Button>
        </div>
      </div>
      {diff && <div className="mx-4 mt-3 max-h-48 overflow-auto rounded-lg border bg-muted/30"><div className="flex items-center justify-between border-b px-3 py-1.5 text-xs font-medium text-muted-foreground"><span>Diff v{selected} → v{current}</span><button type="button" aria-label="Close diff" onClick={onClearDiff} className="rounded p-0.5 hover:bg-muted"><X size={14} /></button></div><div className="p-3 font-mono text-[11px] leading-5">{diffLines.map((line, index) => <div key={`${index}-${line}`} className={line.startsWith("-") ? "bg-red-100 px-1 text-red-800 dark:bg-red-950/40 dark:text-red-200" : line.startsWith("+") ? "bg-green-100 px-1 text-green-800 dark:bg-green-950/40 dark:text-green-200" : "px-1 text-muted-foreground"}>{line || " "}</div>)}</div></div>}
      <div className="min-h-0 flex-1 overflow-auto p-4"><MDEditor.Markdown source={brd.pendingContentMarkdown ?? content} /></div>
    </section>
  );
}
