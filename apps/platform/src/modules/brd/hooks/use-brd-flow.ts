import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { clearPendingImport, getBrdFlow, type BrdFlowSnapshot } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Checkpoint clarify/generate per project dari server, dipakai untuk hydrate
 * pertanyaan yang belum dijawab, menawarkan lanjutan generate, dan antrian impor.
 * Semua sesi dalam project yang sama berbagi checkpoint ini.
 */
export function useBrdFlow(projectId: string | null, sessionId: string | null) {
  const queryClient = useQueryClient();

  const flowQuery = useQuery({
    queryKey: ["brd-flow", projectId],
    queryFn: () => getBrdFlow(projectId ?? "").then((response) => response.flow),
    enabled: projectId !== null,
  });

  const refresh = useCallback(async () => {
    if (!projectId) return;
    await queryClient.invalidateQueries({ queryKey: ["brd-flow", projectId] });
  }, [queryClient, projectId]);

  const dismissPendingImport = useCallback(async () => {
    if (!sessionId) return;
    await clearPendingImport(sessionId);
    await queryClient.invalidateQueries({ queryKey: ["brd-flow", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["session", sessionId, "documents"] });
  }, [queryClient, projectId, sessionId]);

  return {
    flow: flowQuery.data ?? null,
    loading: flowQuery.isPending,
    error: flowQuery.isError ? messageOf(flowQuery.error) : null,
    refresh,
    dismissPendingImport,
  };
}

export type { BrdFlowSnapshot };