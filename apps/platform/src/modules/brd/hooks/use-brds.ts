import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBrd, listBrds, type BrdDocument } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useBrds(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [cachedActive, setCachedActive] = useState<BrdDocument | null>(null);
  // Tracks ids chosen through select()/setActive() so the list effect never
  // resets a freshly created BRD that is not yet present in the query cache.
  const selectedRef = useRef<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["brds", sessionId],
    queryFn: () => listBrds(sessionId ?? "").then((response) => response.brds),
    enabled: sessionId !== null,
  });
  const brds = listQuery.data ?? [];

  useEffect(() => {
    setCachedActive(null);
    if (!sessionId) {
      selectedRef.current = null;
      setActiveId(null);
      return;
    }
    const preferred =
      selectedRef.current && brds.some((brd) => brd.id === selectedRef.current)
        ? selectedRef.current
        : brds[0]?.id ?? null;
    setActiveId(preferred);
  }, [sessionId, brds]);

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
  const loading = listQuery.isPending || (activeId !== null && activeQuery.isPending);

  const select = useCallback(
    (id: string) => {
      selectedRef.current = id;
      setActiveId(id);
      void queryClient.invalidateQueries({ queryKey: ["brds", sessionId] });
    },
    [queryClient, sessionId],
  );

  const setActive = useCallback((brd: BrdDocument | null) => {
    selectedRef.current = brd?.id ?? null;
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
