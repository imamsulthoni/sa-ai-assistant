import type { ContextChunk } from "../tools/context.js";

export function distillContext(
  chunks: readonly ContextChunk[],
  options: { topK?: number; maxChars?: number } = {},
) {
  const topK = Math.max(1, Math.min(options.topK ?? 5, 5));
  const maxChars = Math.max(200, options.maxChars ?? 4000);
  const selected = [...chunks].sort((a, b) => b.score - a.score).slice(0, topK);
  let used = 0;
  const result = selected.flatMap((chunk) => {
    const remaining = maxChars - used;
    if (remaining <= 0) return [];
    const content = chunk.content.trim().slice(0, remaining);
    used += content.length;
    return [`[${chunk.documentId}${chunk.pageNumber ? ` p.${chunk.pageNumber}` : ""}] ${content}`];
  });
  return result.join("\n\n");
}
