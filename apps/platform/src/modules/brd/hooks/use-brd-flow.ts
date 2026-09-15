import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { clearPendingImport, getBrdFlow, type BrdFlowSnapshot } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checkpoint clarify/generate per sesi dari server, dipakai untuk hydrate
 * pertanyaan yang belum dijawab, menawarkan lanjutan generate, dan antrian impor.
 */
export function useBrdFlow(sessionId: string | null) {
  const queryClient = useQueryClient();

  const flowQuery = useQuery({
    queryKey: ["brd-flow", sessionId],
    queryFn: () => getBrdFlow(sessionId ?? "").then((response) => response.flow),
    enabled: sessionId !== null,
  });

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    await queryClient.invalidateQueries({ queryKey: ["brd-flow", sessionId] });
  }, [queryClient, sessionId]);

  const dismissPendingImport = useCallback(async () => {
    if (!sessionId) return;
    await clearPendingImport(sessionId);
    await queryClient.invalidateQueries({ queryKey: ["brd-flow", sessionId] });
    await queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
  }, [queryClient, sessionId]);

  return {
    flow: flowQuery.data ?? null,
    loading: flowQuery.isPending,
    error: flowQuery.isError ? messageOf(flowQuery.error) : null,
    refresh,
    dismissPendingImport,
  };
}

export type { BrdFlowSnapshot };
