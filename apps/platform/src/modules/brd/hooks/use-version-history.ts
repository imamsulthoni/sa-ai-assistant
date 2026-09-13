import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { createBrdVersion, getBrd, getBrdDiff, restoreBrd, type BrdDocument } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useVersionHistory(brd: BrdDocument | null, onChange: (brd: BrdDocument) => void) {
  const queryClient = useQueryClient();
  const brdId = brd?.id ?? null;
  const [diffPair, setDiffPair] = useState<{ from: number; to: number } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setDiffPair(null);
  }, [brdId]);

  const diffQuery = useQuery({
    queryKey: ["brd", brdId, "diff", diffPair?.from, diffPair?.to],
    queryFn: () =>
      getBrdDiff(brdId ?? "", diffPair?.from ?? 0, diffPair?.to ?? 0).then(
        (response) => response.diff,
      ),
    enabled: brdId !== null && diffPair !== null,
  });
  const diff = diffQuery.data ?? null;
  const error = actionError ?? (diffQuery.isError ? messageOf(diffQuery.error) : null);

  const refreshBrd = useCallback(async () => {
    if (!brdId) return;
    const updated = await getBrd(brdId).then((response) => response.brd);
    onChange(updated);
  }, [brdId, onChange]);

  const saveMutation = useMutation({
    mutationFn: ({
      contentMarkdown,
      changeSummary,
    }: {
      contentMarkdown: string;
      changeSummary: string;
    }) => createBrdVersion(brdId ?? "", { contentMarkdown, changeSummary }),
    onSuccess: async () => {
      if (!brdId) return;
      void queryClient.invalidateQueries({ queryKey: ["brd", brdId] });
      await refreshBrd();
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const save = useCallback(
    async (contentMarkdown: string, changeSummary?: string) => {
      if (!brdId) return;
      setActionError(null);
      await saveMutation.mutateAsync({
        contentMarkdown,
        changeSummary: changeSummary ?? "Manual editor update",
      });
    },
    [brdId, saveMutation],
  );

  const showDiff = useCallback(
    (from: number, to: number) => {
      if (!brdId) return;
      setActionError(null);
      setDiffPair({ from, to });
    },
    [brdId],
  );

  const restoreMutation = useMutation({
    mutationFn: (version: number) => restoreBrd(brdId ?? "", version),
    onSuccess: async () => {
      if (!brdId) return;
      void queryClient.invalidateQueries({ queryKey: ["brd", brdId] });
      await refreshBrd();
    },
    onError: (caught) => setActionError(messageOf(caught)),
  });

  const restore = useCallback(
    async (version: number) => {
      if (!brdId) return;
      setActionError(null);
      await restoreMutation.mutateAsync(version);
    },
    [brdId, restoreMutation],
  );

  const clearDiff = useCallback(() => setDiffPair(null), []);

  return {
    diff,
    busy: saveMutation.isPending || restoreMutation.isPending,
    error,
    save,
    showDiff,
    restore,
    clearDiff,
  };
}
