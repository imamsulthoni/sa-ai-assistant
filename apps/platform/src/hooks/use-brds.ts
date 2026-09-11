import { useCallback, useEffect, useRef, useState } from "react";
import { getBrd, listBrds, type BrdDocument } from "#/lib/api";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useBrds(sessionId: string | null) {
  const [brds, setBrds] = useState<BrdDocument[]>([]);
  const [active, setActive] = useState<BrdDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = active?.id ?? null;
  }, [active]);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setBrds([]);
      setActive(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { brds: list } = await listBrds(sessionId);
      setBrds(list);
      const target = list.find((brd) => brd.id === activeIdRef.current) ?? list[0] ?? null;
      setActive(target ? (await getBrd(target.id)).brd : null);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(async (id: string) => {
    setError(null);
    try {
      setActive((await getBrd(id)).brd);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  return { brds, active, setActive, select, loading, error, refresh };
}
