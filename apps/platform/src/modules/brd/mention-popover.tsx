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
    <div className="absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
          <AtSign size={13} className="text-slate-500" />
          <span>Sebut Dokumen Sebagai Konteks</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup daftar file"
          className="cursor-pointer text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X size={13} />
        </button>
      </div>

      <div className="border-b border-slate-100 p-2 dark:border-slate-800">
        <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950">
          <Search size={12} className="shrink-0 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari file di project ini…"
            className="min-w-0 flex-1 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
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
            className="flex w-full min-w-0 cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <FileText size={12} className="shrink-0 text-slate-400" />
            <span className="truncate">@{result.title}</span>
          </button>
        ))}
        {trimmed && results.length === 0 && (
          <p className="px-2 py-3 text-center text-[11px] text-slate-400">
            Tidak ada file di project ini.
          </p>
        )}
      </div>
    </div>
  );
}
