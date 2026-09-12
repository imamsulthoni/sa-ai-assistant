import { RotateCcw } from "lucide-react";
import { Button } from "#/components/ui/button";
import type { BrdDocument } from "#/lib/api";

type VersionHistoryProps = {
  brd: BrdDocument;
  diff: string | null;
  onDiff: (from: number, to: number) => void;
  onRestore: (version: number) => void;
};

export function VersionHistory({ brd, diff, onDiff, onRestore }: VersionHistoryProps) {
  const versions = brd.versions ?? [];
  const diffLines = diff?.split("\n") ?? [];

  return (
    <aside className="flex w-full shrink-0 flex-col border-t bg-muted/30 lg:w-64 lg:border-l lg:border-t-0">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          History
        </p>
        <h2 className="font-semibold">Versions</h2>
      </div>
      <div className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className="min-w-36 rounded-lg border bg-background p-2 text-xs lg:min-w-0"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="font-semibold hover:underline"
                onClick={() => onDiff(version.versionNumber, brd.currentVersion)}
              >
                v{version.versionNumber}
              </button>
              {version.versionNumber === brd.currentVersion && (
                <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                  active
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-muted-foreground">
              {version.changeSummary ?? "Snapshot"}
            </p>
            {version.versionNumber !== brd.currentVersion && (
              <Button
                size="xs"
                variant="ghost"
                className="mt-1"
                onClick={() => onRestore(version.versionNumber)}
              >
                <RotateCcw size={12} /> Restore
              </Button>
            )}
          </div>
        ))}
        {versions.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
      </div>
      {diff && (
        <div className="max-h-64 overflow-auto border-t bg-background p-3 font-mono text-[11px] leading-5">
          {diffLines.map((line, index) => {
            const removed = line.startsWith("-");
            const added = line.startsWith("+");
            return (
              <div
                key={`${index}-${line}`}
                className={
                  removed
                    ? "bg-red-100 px-1 text-red-800 dark:bg-red-950/40 dark:text-red-200"
                    : added
                      ? "bg-green-100 px-1 text-green-800 dark:bg-green-950/40 dark:text-green-200"
                      : "px-1 text-muted-foreground"
                }
              >
                {line || " "}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
