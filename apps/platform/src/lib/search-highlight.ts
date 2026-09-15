export const SEARCH_HIGHLIGHT_NAME = "brd-search";

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

/**
 * Tandai semua kemunculan query di dalam root memakai CSS Custom Highlight API.
 * Browser tanpa dukungan cukup tidak menampilkan sorotan. Mengembalikan fungsi bersih-bersih.
 */
export function highlightMatches(root: HTMLElement, query: string): () => void {
  const registry = highlightRegistry();
  const HighlightClass = highlightCtor();
  if (!registry || !HighlightClass) return () => undefined;

  registry.delete(SEARCH_HIGHLIGHT_NAME);
  const term = query.trim().toLowerCase();
  if (!term) return () => undefined;

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

  if (ranges.length) registry.set(SEARCH_HIGHLIGHT_NAME, new HighlightClass(...ranges));
  return () => registry.delete(SEARCH_HIGHLIGHT_NAME);
}
