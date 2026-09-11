import { useCallback, useState } from "react";
import { createBrdVersion, getBrd, getBrdDiff, restoreBrd, type BrdDocument } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useVersionHistory(brd: BrdDocument | null, onChange: (brd: BrdDocument) => void) {
  const [diff, setDiff] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const brdId = brd?.id ?? null;

  const refresh = useCallback(async () => {
    if (!brdId) return;
    onChange((await getBrd(brdId)).brd);
  }, [brdId, onChange]);

  const save = useCallback(
    async (contentMarkdown: string, changeSummary?: string) => {
      if (!brdId) return;
      setBusy(true);
      setError(null);
      try {
        await createBrdVersion(brdId, {
          contentMarkdown,
          changeSummary: changeSummary ?? "Manual editor update",
        });
        await refresh();
      } catch (caught) {
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [brdId, refresh],
  );

  const showDiff = useCallback(
    async (from: number, to: number) => {
      if (!brdId) return;
      setError(null);
      try {
        setDiff((await getBrdDiff(brdId, from, to)).diff);
      } catch (caught) {
        setError(messageOf(caught));
      }
    },
    [brdId],
  );

  const restore = useCallback(
    async (version: number) => {
      if (!brdId) return;
      setBusy(true);
      setError(null);
      try {
        await restoreBrd(brdId, version);
        await refresh();
      } catch (caught) {
        setError(messageOf(caught));
      } finally {
        setBusy(false);
      }
    },
    [brdId, refresh],
  );

  const clearDiff = useCallback(() => setDiff(null), []);

  return { diff, busy, error, save, showDiff, restore, clearDiff };
}
