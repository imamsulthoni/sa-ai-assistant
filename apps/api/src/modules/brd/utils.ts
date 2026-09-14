export async function bodyOf(c: { req: { json(): Promise<unknown> } }): Promise<unknown> {
  return (await c.req.json().catch(() => null)) as unknown;
}

type DiffPart = { type: "context" | "added" | "removed"; text: string };

/** Line-based LCS diff so insertions do not mark the whole rest of the file as changed. */
function lcsDiffParts(before: string[], after: string[]): DiffPart[] {
  const rows = before.length;
  const columns = after.length;
  const lcs: number[][] = Array.from({ length: rows + 1 }, () =>
    Array.from({ length: columns + 1 }, () => 0),
  );
  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = columns - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < columns) {
    if (before[i] === after[j]) {
      parts.push({ type: "context", text: before[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      parts.push({ type: "removed", text: before[i] });
      i += 1;
    } else {
      parts.push({ type: "added", text: after[j] });
      j += 1;
    }
  }
  while (i < rows) {
    parts.push({ type: "removed", text: before[i] });
    i += 1;
  }
  while (j < columns) {
    parts.push({ type: "added", text: after[j] });
    j += 1;
  }
  return parts;
}

export function simpleDiff(before: string, after: string): string {
  const parts = lcsDiffParts(before.split("\n"), after.split("\n"));
  const output = ["--- before", "+++ after"];
  for (const part of parts) {
    if (part.type === "context") output.push(part.text);
    else output.push(`${part.type === "removed" ? "-" : "+"}${part.text}`);
  }
  return output.join("\n");
}

export function filename(title: string, extension: string): string {
  return `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "brd"}.${extension}`;
}
