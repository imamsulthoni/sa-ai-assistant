export const DEFAULT_TITLE = "New chat";
export const TITLE_MAX_LENGTH = 60;

export function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part && typeof part === "object" && "text" in part
        ? String((part as { text: unknown }).text ?? "")
        : "",
    )
    .filter((text) => text.length > 0)
    .join(" ")
    .trim();
}

/** Title a session from the first user message, keeping it single-line and short. */
export function titleFromContent(content: unknown): string | null {
  const text = extractText(content);
  if (!text) return null;
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (!singleLine) return null;
  return singleLine.length > TITLE_MAX_LENGTH
    ? `${singleLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : singleLine;
}
