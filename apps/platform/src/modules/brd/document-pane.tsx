import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code,
  Copy,
  Download,
  FileDown,
  FileText,
  History,
  ListTree,
  Search,
  ShieldCheck,
  SplitSquareVertical,
} from "lucide-react";
import { cn } from "#/lib/utils";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { MarkdownContent } from "#/components/markdown/markdown-content";
import { buildToc } from "#/lib/markdown-toc";
import { highlightMatches, type SearchHighlights } from "#/lib/search-highlight";
import {
  approveBrdModification,
  exportBrd,
  rejectBrdModification,
  updateBrdStatus,
  type BrdDocument,
} from "#/lib/api";
import { BRD_STATUS_ACTIONS, BRD_STATUS_LABEL, COPY } from "#/lib/copy";
import { notify } from "#/lib/notify";
import { BrdDiffView, type CompareTarget } from "./brd-diff-view";
import { VersionHistory } from "./version-history";

type DocumentPaneProps = {
  brd: BrdDocument;
  content: string;
  diff: string | null;
  onDiff: (from: number, to: number) => void;
  onRestore: (version: number) => void;
  onClearDiff: () => void;
  onApproved: (brd: BrdDocument) => void;
  busy?: boolean;
  tab?: DocumentTab;
  onTabChange?: (tab: DocumentTab) => void;
};

export type DocumentTab = "preview" | "diff" | "history" | "raw";

export function DocumentPane({
  brd,
  content,
  diff,
  onDiff,
  onRestore,
  onClearDiff,
  onApproved,
  busy,
  tab: tabProp,
  onTabChange,
}: DocumentPaneProps) {
  const [internalTab, setInternalTab] = useState<DocumentTab>("preview");
  const tab = tabProp ?? internalTab;
  const setTab = useCallback(
    (next: DocumentTab) => {
      setInternalTab(next);
      onTabChange?.(next);
    },
    [onTabChange],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showToc, setShowToc] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [compareFrom, setCompareFrom] = useState<number | null>(null);
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const searchHighlightsRef = useRef<SearchHighlights | null>(null);
  const searchCursorRef = useRef(-1);

  const versions = brd.versions ?? [];
  const pending = brd.pendingContentMarkdown;
  const current = brd.currentVersion;
  // Versi lama yang sedang dipratinjau menggantikan isi yang ditampilkan,
  // sehingga TOC, pencarian, copy, dan raw ikut membaca versi tersebut.
  const selectedVersion =
    previewVersion !== null
      ? (versions.find((version) => version.versionNumber === previewVersion) ?? null)
      : null;
  const displayContent = selectedVersion?.contentMarkdown ?? content;
  const displayedVersion = selectedVersion?.versionNumber ?? current;
  const toc = useMemo(() => buildToc(displayContent), [displayContent]);
  const statusActions = BRD_STATUS_ACTIONS[brd.status] ?? [];

  useEffect(() => {
    setCompareFrom(null);
    setPreviewVersion(null);
    onClearDiff();
    setSearchQuery("");
  }, [brd.id, brd.currentVersion, onClearDiff]);

  useEffect(() => {
    if (pending) setTab("diff");
  }, [pending]);

  // Sorotan pencarian hanya menyentuh DOM pratinjau, bukan tree markdown.
  useEffect(() => {
    const element = previewRef.current;
    if (!element || tab !== "preview") return;
    const highlights = highlightMatches(element, searchQuery);
    searchHighlightsRef.current = highlights;
    searchCursorRef.current = -1;
    return () => {
      searchHighlightsRef.current = null;
      highlights.clear();
    };
  }, [searchQuery, tab, displayContent]);

  const focusMatch = useCallback((step: number) => {
    const highlights = searchHighlightsRef.current;
    if (!highlights || highlights.count === 0) return;
    const total = highlights.count;
    const current = searchCursorRef.current;
    const next =
      current < 0
        ? step > 0
          ? 0
          : total - 1
        : (current + step + total) % total;
    searchCursorRef.current = next;
    highlights.focus(next);
  }, []);

  const copyText = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      notify.error("Gagal menyalin ke clipboard.");
    }
  }, []);

  const approve = async () => {
    setApprovalBusy(true);
    try {
      const result = await approveBrdModification(brd.id);
      onApproved(result.brd);
      notify.success("Perubahan BRD disetujui sebagai versi baru.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal menyetujui perubahan.");
    } finally {
      setApprovalBusy(false);
    }
  };

  const reject = async () => {
    setApprovalBusy(true);
    try {
      const result = await rejectBrdModification(brd.id);
      onApproved(result.brd);
      notify.info("Pratinjau perubahan ditolak.");
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal menolak perubahan.");
    } finally {
      setApprovalBusy(false);
    }
  };

  const changeStatus = async (next: BrdDocument["status"]) => {
    setStatusBusy(true);
    try {
      const result = await updateBrdStatus(brd.id, next);
      onApproved(result.brd);
      notify.success(`Status BRD diperbarui: ${BRD_STATUS_LABEL[next]}.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Gagal mengubah status BRD.");
    } finally {
      setStatusBusy(false);
    }
  };

  const handleExport = async (format: "markdown" | "pdf") => {
    const toastId = notify.loading("Menyiapkan berkas…");
    try {
      await exportBrd(brd.id, format);
      notify.dismiss(toastId);
      notify.success("Berkas berhasil diunduh.");
    } catch (error) {
      notify.dismiss(toastId);
      notify.error(error instanceof Error ? error.message : "Export gagal.");
    }
  };

  const compare: CompareTarget | null =
    diff && compareFrom ? { from: compareFrom, to: current, diff } : null;

  const openVersion = (version: number) => {
    setCompareFrom(version);
    onDiff(version, current);
    setTab("diff");
  };

  // Anchor id dari markdown tidak stabil karena renderer memecah dokumen per blok,
  // jadi daftar isi menavigasi lewat teks heading di dalam panel pratinjau.
  const scrollToHeading = (text: string) => {
    setTab("preview");
    window.setTimeout(() => {
      const container = previewRef.current;
      if (!container) return;
      const target = text.trim().toLowerCase();
      const headings = container.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      for (const heading of headings) {
        if ((heading.textContent ?? "").trim().toLowerCase() === target) {
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
      }
    }, 0);
  };

  const closeCompare = () => {
    setCompareFrom(null);
    onClearDiff();
    setTab("preview");
  };

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col bg-muted">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3.5 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-xs font-semibold text-success">
            <ShieldCheck size={12} />v{current}.0
          </span>
          <h2 className="max-w-xs truncate text-xs font-bold text-foreground md:max-w-md">
            {brd.title}
          </h2>
          <Badge tone={statusTone(brd.status)}>{BRD_STATUS_LABEL[brd.status]}</Badge>
          {pending && (
            <button
              type="button"
              onClick={() => setTab("diff")}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning"
            >
              Usulan v{current + 1}.0 menunggu review
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!pending &&
            statusActions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.status === "APPROVED" ? "success" : "outline"}
                disabled={statusBusy}
                onClick={() => void changeStatus(action.status)}
              >
                {action.label}
              </Button>
            ))}

          <div className="relative hidden md:block">
            <Search
              size={12}
              className="absolute top-1/2 left-2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                focusMatch(event.shiftKey ? -1 : 1);
              }}
              placeholder="Cari klausul…"
              aria-label="Cari klausul di dokumen"
              className="w-32 rounded border border-input bg-muted py-1 pr-2 pl-6 text-xs text-foreground transition-all focus:w-44 focus:bg-card focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowToc((open) => !open)}
            title="Daftar Isi"
            aria-pressed={showToc}
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded border transition-colors",
              showToc
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <ListTree size={13} />
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void copyText(displayContent, "doc")}
          >
            {copied === "doc" ? (
              <Check size={13} className="text-success" />
            ) : (
              <Copy size={13} className="text-muted-foreground" />
            )}
            {copied === "doc" ? "Tersalin" : "Salin"}
          </Button>

          <Button variant="outline" size="sm" onClick={() => void handleExport("markdown")}>
            <Download size={13} className="text-muted-foreground" /> .MD
          </Button>

          <Button variant="solid" size="sm" onClick={() => void handleExport("pdf")}>
            <FileDown size={13} /> PDF
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-3.5 text-xs font-semibold">
        <TabButton active={tab === "preview"} onClick={() => setTab("preview")}>
          <FileText size={12} />
          {selectedVersion
            ? COPY.workspace.previewVersionTab(selectedVersion.versionNumber)
            : "Preview BRD"}
        </TabButton>
        <TabButton active={tab === "diff"} onClick={() => setTab("diff")}>
          <SplitSquareVertical size={12} /> Review Diff
          {pending && (
            <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-warning" />
          )}
        </TabButton>
        <TabButton active={tab === "history"} onClick={() => setTab("history")}>
          <History size={12} /> Riwayat ({versions.length})
        </TabButton>
        <TabButton active={tab === "raw"} onClick={() => setTab("raw")}>
          <Code size={12} /> Raw .MD
        </TabButton>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {showToc && (
          <div className="w-56 shrink-0 overflow-y-auto border-r border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between border-b border-border pb-1.5">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                Daftar Isi
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{toc.length}</span>
            </div>
            <div className="space-y-0.5 text-xs">
              {toc.length === 0 && <p className="p-1 text-[11px] text-muted-foreground">Tanpa heading.</p>}
              {toc.map((item) => (
                <button
                  key={`${item.line}-${item.slug}`}
                  type="button"
                  onClick={() => scrollToHeading(item.text)}
                  className="w-full cursor-pointer truncate rounded p-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-muted"
                  style={{ paddingLeft: `${(item.level - 2) * 8 + 4}px` }}
                >
                  {item.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-3.5 md:p-5">
          {tab === "preview" && (
            <div className="mx-auto max-w-4xl space-y-3">
              {selectedVersion && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-[11px] text-info">
                  <span className="font-medium">
                    {COPY.workspace.previewOldVersion(selectedVersion.versionNumber, current)}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewVersion(null)}
                      className="cursor-pointer font-semibold underline-offset-2 hover:underline"
                    >
                      {COPY.workspace.backToCurrent}
                    </button>
                    <button
                      type="button"
                      onClick={() => openVersion(selectedVersion.versionNumber)}
                      className="cursor-pointer font-semibold underline-offset-2 hover:underline"
                    >
                      {COPY.workspace.compareWithCurrent}
                    </button>
                  </div>
                </div>
              )}
              <div
                ref={previewRef}
                className="rounded-lg border border-border bg-card p-5 shadow-xs md:p-8"
              >
                <MarkdownContent source={displayContent} />
              </div>
            </div>
          )}

          {tab === "diff" && (
            <div className="h-full">
              <BrdDiffView
                currentVersion={current}
                content={content}
                pending={pending}
                pendingSummary={brd.pendingChangeSummary}
                compare={compare}
                busy={busy || approvalBusy}
                onApprove={() => void approve()}
                onReject={() => void reject()}
                onCloseCompare={closeCompare}
              />
            </div>
          )}

          {tab === "history" && (
            <div className="mx-auto max-w-2xl">
              <VersionHistory
                versions={versions}
                currentVersion={current}
                compareFrom={compareFrom}
                previewVersion={previewVersion}
                onPreview={(version) => {
                  setPreviewVersion(version);
                  setCompareFrom(null);
                  setTab("preview");
                }}
                onShowCurrent={() => {
                  setPreviewVersion(null);
                  setCompareFrom(null);
                  setTab("preview");
                }}
                onOpen={openVersion}
                onRestore={(version) => {
                  onRestore(version);
                  setCompareFrom(null);
                  setPreviewVersion(null);
                  setTab("preview");
                }}
                busy={busy}
              />
            </div>
          )}

          {tab === "raw" && (
            <div className="mx-auto max-w-4xl overflow-x-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs text-foreground">
              <div className="mb-2 flex items-center justify-between border-b border-border pb-2 text-muted-foreground">
                <span className="text-[11px]">Markdown Source (v{displayedVersion}.0)</span>
                <button
                  type="button"
                  onClick={() => void copyText(displayContent, "raw")}
                  className="cursor-pointer rounded bg-foreground px-2 py-0.5 text-[11px] text-background transition-colors hover:bg-foreground/90"
                >
                  {copied === "raw" ? "Tersalin!" : "Copy Code"}
                </button>
              </div>
              <pre className="leading-relaxed whitespace-pre-wrap">{displayContent}</pre>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function statusTone(status: BrdDocument["status"]): "neutral" | "info" | "success" {
  if (status === "APPROVED") return "success";
  if (status === "IN_REVIEW") return "info";
  return "neutral";
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 border-b-2 py-2 transition-colors",
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
