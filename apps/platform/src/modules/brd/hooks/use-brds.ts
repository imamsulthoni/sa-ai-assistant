import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { getBrd, listBrds, type BrdDocument } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useBrds(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cachedActive, setCachedActive] = useState<BrdDocument | null>(null);

  const listQuery = useQuery({
    queryKey: ["brds", sessionId],
    queryFn: () => listBrds(sessionId ?? "").then((response) => response.brds),
    enabled: sessionId !== null,
  });
  const brds = listQuery.data ?? [];

  useEffect(() => {
    setCachedActive(null);
    if (!sessionId) {
      setActiveId(null);
      return;
    }
    if (activeId && brds.some((brd) => brd.id === activeId)) return;
    setActiveId(brds[0]?.id ?? null);
  }, [sessionId, brds, activeId]);

  const activeQuery = useQuery({
    queryKey: ["brd", activeId],
    queryFn: () => getBrd(activeId ?? "").then((response) => response.brd),
    enabled: activeId !== null,
  });
  // Keep showing the last successfully loaded BRD while a refetch is in flight.
  useEffect(() => {
    if (activeQuery.data) setCachedActive(activeQuery.data);
  }, [activeQuery.data]);
  const active = activeQuery.data ?? cachedActive;

  const error = listQuery.isError
    ? messageOf(listQuery.error)
    : activeQuery.isError
      ? messageOf(activeQuery.error)
      : null;
  const loading = listQuery.isPending || activeQuery.isPending;

  const select = useCallback((id: string) => setActiveId(id), []);

  const setActive = useCallback((brd: BrdDocument | null) => {
    setActiveId(brd?.id ?? null);
    setCachedActive(brd);
  }, []);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await queryClient.invalidateQueries({ queryKey: ["brds", sessionId] });
    if (activeId) {
      await queryClient.invalidateQueries({ queryKey: ["brd", activeId] });
    }
  }, [queryClient, sessionId, activeId]);

  return { brds, active, setActive, select, loading, error, refresh };
}
