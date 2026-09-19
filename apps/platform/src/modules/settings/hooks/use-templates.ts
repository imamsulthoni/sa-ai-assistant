import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import {
  approveTemplate,
  deleteTemplate,
  listTemplates,
  type TemplateSummary,
} from "#/lib/api";
import { describeError } from "#/lib/errors";
import { CURRENT_TEMPLATE_QUERY_KEY } from "#/modules/settings/hooks/use-current-template";

export const TEMPLATES_QUERY_KEY = ["settings", "templates"] as const;

/** Daftar semua template BRD user + aksi kelola (aktifkan/hapus). */
export function useTemplates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: TEMPLATES_QUERY_KEY,
    queryFn: () => listTemplates(),
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
    void queryClient.invalidateQueries({ queryKey: CURRENT_TEMPLATE_QUERY_KEY });
    // Judul template project bisa berubah saat template dihapus/diaktifkan.
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["project"] });
  }, [queryClient]);

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveTemplate(id),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: invalidate,
  });

  const templates: TemplateSummary[] = query.data?.templates ?? [];

  return {
    templates,
    activeTemplateId: query.data?.activeTemplateId ?? null,
    loading: query.isPending,
    error: query.isError ? describeError(query.error) : null,
    refresh: invalidate,
    setActive: (id: string) => approveMutation.mutateAsync(id),
    remove: (id: string) => removeMutation.mutateAsync(id),
    busy: approveMutation.isPending || removeMutation.isPending,
  };
}
