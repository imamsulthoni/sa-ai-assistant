import { useQuery } from "@tanstack/react-query";
import { getCurrentTemplate } from "#/lib/api";

export const CURRENT_TEMPLATE_QUERY_KEY = ["settings", "template", "current"] as const;

/** Template BRD aktif (dipakai header, sidebar, dan panel generate). */
export function useCurrentTemplate() {
  const query = useQuery({
    queryKey: CURRENT_TEMPLATE_QUERY_KEY,
    queryFn: () => getCurrentTemplate(),
    staleTime: 60_000,
  });
  const template = query.data?.document ?? null;
  const activeTemplateId = query.data?.activeTemplateId ?? null;
  return {
    template,
    activeTemplateId,
    /** True saat user sudah punya template aktif yang tersimpan. */
    hasTemplate: activeTemplateId !== null,
    loading: query.isPending,
  };
}
