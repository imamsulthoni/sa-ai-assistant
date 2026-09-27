export const SEARCH_HIGHLIGHT_NAME = "brd-search";
export const SEARCH_ACTIVE_HIGHLIGHT_NAME = "brd-search-active";

type HighlightRegistryLike = {
  delete(name: string): void;
  set(name: string, value: unknown): void;
};

type HighlightCtor = new (...ranges: Range[]) => unknown;

function highlightRegistry(): HighlightRegistryLike | null {
  const css = CSS as unknown as { highlights?: HighlightRegistryLike };
  return css.highlights ?? null;
}

function highlightCtor(): HighlightCtor | null {
  return (globalThis as { Highlight?: HighlightCtor }).Highlight ?? null;
}

export type SearchHighlights = {
  count: number;
  focus(index: number): boolean;
  clear(): void;
};

const EMPTY_HIGHLIGHTS: SearchHighlights = {
  count: 0,
  focus: () => false,
  clear: () => undefined,
};

/**
 * Tandai semua kemunculan query di dalam root memakai CSS Custom Highlight API.
 * `focus(index)` menggulir ke kemunculan tersebut dan menandainya sebagai sorotan
 * aktif. Browser tanpa dukungan cukup tidak menampilkan sorotan.
 */
export function highlightMatches(root: HTMLElement, query: string): SearchHighlights {
  const registry = highlightRegistry();
  const HighlightClass = highlightCtor();
  const clear = () => {
    registry?.delete(SEARCH_HIGHLIGHT_NAME);
    registry?.delete(SEARCH_ACTIVE_HIGHLIGHT_NAME);
  };
  if (!registry || !HighlightClass) return EMPTY_HIGHLIGHTS;

  clear();
  const term = query.trim().toLowerCase();
  if (!term) return { ...EMPTY_HIGHLIGHTS, clear };

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const haystack = node.data.toLowerCase();
    let index = haystack.indexOf(term);
    while (index !== -1) {
      const range = new Range();
      range.setStart(node, index);
      range.setEnd(node, index + term.length);
      ranges.push(range);
      index = haystack.indexOf(term, index + term.length);
    }
  }

  if (!ranges.length) return { ...EMPTY_HIGHLIGHTS, clear };
  registry.set(SEARCH_HIGHLIGHT_NAME, new HighlightClass(...ranges));

  return {
    count: ranges.length,
    focus(index) {
      const normalized = ((index % ranges.length) + ranges.length) % ranges.length;
      const active = ranges[normalized]!;
      const others = ranges.filter((_, position) => position !== normalized);
      if (others.length) registry.set(SEARCH_HIGHLIGHT_NAME, new HighlightClass(...others));
      else registry.delete(SEARCH_HIGHLIGHT_NAME);
      registry.set(SEARCH_ACTIVE_HIGHLIGHT_NAME, new HighlightClass(active));
      const target = active.startContainer.parentElement;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    },
    clear,
  };
}