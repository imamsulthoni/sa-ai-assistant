import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, X } from "lucide-react";
import { search, type SearchResult } from "#/lib/api";

type MentionPopoverProps = {
  sessionId: string;
  query?: string;
  onPick: (result: SearchResult) => void;
  onClose: () => void;
};

export function MentionPopover({
  sessionId,
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
    queryKey: ["search", "session-files", trimmed, sessionId],
    queryFn: () => search(trimmed, "document", sessionId).then((response) => response.results),
    enabled: trimmed.length > 0,
    staleTime: 30_000,
  });
  const results = resultsQuery.data ?? [];

  return (
    <div className="absolute bottom-14 left-2 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 shadow-xl">
      <div className="flex items-center gap-2">
        <Search size={14} className="shrink-0 text-muted-foreground" />
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari file di sesi ini…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="button" onClick={onClose} aria-label="Tutup daftar file">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 max-h-52 overflow-auto">
        {results.map((result) => (
          <button
            key={result.id}
            type="button"
            title={`Mention ${result.title}`}
            onClick={() => onPick(result)}
            className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <FileText size={13} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{result.title}</span>
          </button>
        ))}
        {trimmed && results.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Tidak ada file di sesi ini.</p>
        )}
      </div>
    </div>
  );
}
