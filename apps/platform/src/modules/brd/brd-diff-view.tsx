import { cn } from "#/lib/utils";
import { buildCompactDiff, countDiffChanges, type DiffLine } from "#/lib/diff";

type BrdDiffViewProps = {
  before?: string;
  after?: string;
  diff?: string;
  className?: string;
  showSummary?: boolean;
};

function parseDiffString(diff: string): DiffLine[] {
  return diff
    .split("\n")
    .filter((line) => !line.startsWith("--- before") && !line.startsWith("+++ after"))
    .map((line) => {
      if (line.startsWith("+")) return { type: "added", text: line.slice(1) };
      if (line.startsWith("-")) return { type: "removed", text: line.slice(1) };
      return { type: "context", text: line };
    });
}

export function BrdDiffView({
  before,
  after,
  diff,
  className,
  showSummary = true,
}: BrdDiffViewProps) {
  const lines =
    diff !== undefined
      ? parseDiffString(diff)
      : before !== undefined && after !== undefined
        ? buildCompactDiff(before, after)
        : [];
  const counts = countDiffChanges(lines);

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-soft", className)}>
      {showSummary && (
        <div className="flex items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Ringkasan perubahan</span>
          <span className="flex items-center gap-2 font-medium">
            <span className="text-diff-added-foreground">+{counts.added} baris</span>
            <span className="text-diff-removed-foreground">−{counts.removed} baris</span>
          </span>
        </div>
      )}
      <div className="max-h-[55vh] overflow-auto p-2 font-mono text-[11px] leading-5">
        {lines.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            Tidak ada perubahan yang bisa ditampilkan.
          </p>
        ) : (
          lines.map((line, index) => (
            <div
              key={`${index}-${line.text}`}
              className={cn(
                "rounded px-1.5 whitespace-pre-wrap",
                line.type === "added" && "bg-diff-added text-diff-added-foreground",
                line.type === "removed" && "bg-diff-removed text-diff-removed-foreground",
                line.type === "context" && "text-muted-foreground",
              )}
            >
              {line.segments
                ? line.segments.map((segment, segmentIndex) => (
                    <span
                      key={segmentIndex}
                      className={cn(
                        segment.changed &&
                          line.type === "added" &&
                          "font-semibold underline decoration-diff-added-foreground/60",
                        segment.changed &&
                          line.type === "removed" &&
                          "font-semibold line-through decoration-diff-removed-foreground/60",
                      )}
                    >
                      {segment.text}
                    </span>
                  ))
                : line.text || " "}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
