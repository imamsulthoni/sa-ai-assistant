export type DiffSegment = {
  text: string;
  changed: boolean;
};

export type DiffLine = {
  type: "added" | "removed" | "context";
  text: string;
  segments?: DiffSegment[];
};

const CONTEXT_LINES = 2;

type DiffPart<T> = { type: DiffLine["type"]; value: T };

function lcsDiff<T>(a: readonly T[], b: readonly T[]): DiffPart<T>[] {
  const n = a.length;
  const m = b.length;

  const lcs: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const result: DiffPart<T>[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      result.push({ type: "context", value: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      result.push({ type: "removed", value: a[i] });
      i += 1;
    } else {
      result.push({ type: "added", value: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    result.push({ type: "removed", value: a[i] });
    i += 1;
  }
  while (j < m) {
    result.push({ type: "added", value: b[j] });
    j += 1;
  }
  return result;
}

function diffLines(before: string, after: string): DiffLine[] {
  return lcsDiff(before.split("\n"), after.split("\n")).map((part) => ({
    type: part.type,
    text: part.value,
  }));
}

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? [];
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    const last = merged.at(-1);
    if (last && last.changed === segment.changed) last.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

/** Bandingkan dua baris per kata agar hanya bagian yang benar-benar berubah yang ditandai. */
function wordDiff(before: string, after: string): { before: DiffSegment[]; after: DiffSegment[] } {
  const parts = lcsDiff(tokenize(before), tokenize(after));
  const beforeSegments: DiffSegment[] = [];
  const afterSegments: DiffSegment[] = [];
  for (const part of parts) {
    if (part.type !== "added")
      beforeSegments.push({ text: part.value, changed: part.type === "removed" });
    if (part.type !== "removed")
      afterSegments.push({ text: part.value, changed: part.type === "added" });
  }
  return { before: mergeSegments(beforeSegments), after: mergeSegments(afterSegments) };
}

/** Pasangkan baris removed/added yang berurutan, lalu lampirkan penanda kata yang berubah. */
function attachWordSegments(lines: DiffLine[]): DiffLine[] {
  let index = 0;
  while (index < lines.length) {
    if (lines[index].type === "context") {
      index += 1;
      continue;
    }
    let end = index;
    while (end < lines.length && lines[end].type !== "context") end += 1;
    const removed = lines.slice(index, end).filter((line) => line.type === "removed");
    const added = lines.slice(index, end).filter((line) => line.type === "added");
    const pairs = Math.min(removed.length, added.length);
    for (let pair = 0; pair < pairs; pair += 1) {
      const diff = wordDiff(removed[pair].text, added[pair].text);
      removed[pair].segments = diff.before;
      added[pair].segments = diff.after;
    }
    for (let cursor = index; cursor < end; cursor += 1) {
      if (!lines[cursor].segments) {
        lines[cursor].segments = [{ text: lines[cursor].text, changed: true }];
      }
    }
    index = end;
  }
  return lines;
}

/** Diff dengan konteks terbatas: baris "context" berurutan di luar jangkauan dipangkas jadi marker. */
export function buildCompactDiff(before: string, after: string): DiffLine[] {
  const full = attachWordSegments(diffLines(before, after));
  const keep = new Set<number>();

  full.forEach((line, index) => {
    if (line.type === "context") return;
    for (let offset = -CONTEXT_LINES; offset <= CONTEXT_LINES; offset += 1) {
      const neighbor = index + offset;
      if (neighbor >= 0 && neighbor < full.length) keep.add(neighbor);
    }
  });

  const result: DiffLine[] = [];
  let skipping = false;
  full.forEach((line, index) => {
    if (keep.has(index)) {
      result.push(line);
      skipping = false;
    } else if (!skipping) {
      result.push({ type: "context", text: "…" });
      skipping = true;
    }
  });
  return result;
}

export function countDiffChanges(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of lines) {
    if (line.type === "added") added += 1;
    else if (line.type === "removed") removed += 1;
  }
  return { added, removed };
}
