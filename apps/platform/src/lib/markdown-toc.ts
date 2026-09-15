export type TocItem = {
  level: number;
  text: string;
  slug: string;
  /** Nomor baris 1-based agar heading bisa dipetakan ke anchor yang stabil. */
  line: number;
};

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "bagian";
}

/** Susun daftar isi dari heading level 2–4 di luar blok kode. */
export function buildToc(markdown: string, minLevel = 2, maxLevel = 4): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  let inFence = false;

  const lines = markdown.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level < minLevel || level > maxLevel) continue;

    const text = match[2].replace(/[*_`~]/g, "").trim();
    if (!text) continue;
    const base = slugify(text);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    items.push({ level, text, slug: count ? `${base}-${count}` : base, line: index + 1 });
  }

  return items;
}
