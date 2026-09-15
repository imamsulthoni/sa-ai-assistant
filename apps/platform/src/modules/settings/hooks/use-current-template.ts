import { useQuery } from "@tanstack/react-query";
import { getCurrentTemplate } from "#/lib/api";

export const CURRENT_TEMPLATE_QUERY_KEY = ["settings", "template", "current"] as const;

/** Template BRD aktif (dipakai header, sidebar, dan panel generate). */
export function useCurrentTemplate() {
  const query = useQuery({
    queryKey: CURRENT_TEMPLATE_QUERY_KEY,
    queryFn: () => getCurrentTemplate().then((response) => response.document),
    staleTime: 60_000,
  });
  return { template: query.data ?? null, loading: query.isPending };
}
