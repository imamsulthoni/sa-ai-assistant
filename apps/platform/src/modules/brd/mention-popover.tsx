import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AtSign, FileText, Search, X } from "lucide-react";
import { search, type SearchResult } from "#/lib/api";

type MentionPopoverProps = {
  projectId: string;
  query?: string;
  onPick: (result: SearchResult) => void;
  onClose: () => void;
};

export function MentionPopover({
  projectId,
  query: initialQuery = "",
  onPick,
  onClose,
}: MentionPopoverProps) {
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const trimmed = query.trim();
  const resultsQuery = useQuery({
    queryKey: ["search", "project-files", trimmed, projectId],
    queryFn: () =>
      search(trimmed, "document", { projectId }).then((response) => response.results),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
  const results = resultsQuery.data ?? [];

  return (
    <div className="absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-xl">
      <div className="flex items-center justify-between border-b border-border bg-muted px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
          <AtSign size={13} className="text-muted-foreground" />
          <span>Sebut Dokumen Sebagai Konteks</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup daftar file"
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={13} />
        </button>
      </div>

      <div className="border-b border-border p-2">
        <div className="flex items-center gap-2 rounded border border-input bg-card px-2 py-1">
          <Search size={12} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari file di project ini…"
            className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="max-h-52 overflow-auto p-1">
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            title={`Mention ${result.title}`}
            onClick={() => onPick(result)}
            className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted"
          >
            <FileText size={12} className="shrink-0 text-muted-foreground" />
            <span className="truncate">@{result.title}</span>
          </button>
        ))}
        {trimmed && results.length === 0 && (
          <p className="px-2 py-3 text-center text-[11px] text-muted-foreground">
            Tidak ada file di project ini.
          </p>
        )}
      </div>
    </div>
  );
}
