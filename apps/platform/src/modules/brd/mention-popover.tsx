import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Eye, Search, X } from "lucide-react";
import { search, type SearchResult } from "#/lib/api";

export type MentionAction = "reference" | "copy";

type MentionPopoverProps = {
  sessionId: string;
  query?: string;
  onPick: (result: SearchResult, action: MentionAction) => void;
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
    queryKey: ["search", trimmed, sessionId],
    queryFn: () => search(trimmed, "brd", sessionId).then((response) => response.results),
    enabled: trimmed.length > 0,
    staleTime: 60_000,
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
          placeholder="Search another session… (excl. active)"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        <button type="button" onClick={onClose} aria-label="Close mentions">
          <X size={14} />
        </button>
      </div>
      <div className="mt-2 max-h-52 overflow-auto">
        {results.map((result) => (
          <div
            key={result.id}
            className="flex w-full items-center gap-1 rounded-lg px-1 py-1 text-left text-sm hover:bg-accent"
          >
            <button
              type="button"
              title="Reference (read-only)"
              onClick={() => onPick(result, "reference")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1"
            >
              <Eye size={13} className="shrink-0 text-muted-foreground" />
              <span className="truncate">{result.title}</span>
            </button>
            <button
              type="button"
              title="Copy into this session"
              aria-label={`Copy ${result.title} into this session`}
              onClick={() => onPick(result, "copy")}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background"
            >
              <Copy size={13} />
            </button>
          </div>
        ))}
        {query.trim() && results.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">No BRD found.</p>
        )}
      </div>
    </div>
  );
}
