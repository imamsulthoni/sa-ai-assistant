import type { ActiveBrdVersion } from "./context.js";

export type BrdSectionNode = {
  id: string | null;
  title: string;
  level: number;
  /** Jumlah karakter body (tanpa heading), whitespace dinormalisasi. */
  chars: number;
  /** Requirement id yang berada di dalam subtree section ini. */
  requirementIds: string[];
  start: number;
  end: number;
};

export type BrdSectionMatch = {
  node: BrdSectionNode;
  /** Heading + seluruh subtree, siap dikirim sebagai konteks model. */
  content: string;
};

const HEADING = /^(#{1,6})\s+(.*)$/;
const REQUIREMENT_HEADING = /^#{2,6}\s+((?:BR|FR)-\d+)\b/i;
const TITLE_HEADING = /^#\s+(.+)$/m;

export function brdTitle(markdown: string): string | null {
  const match = TITLE_HEADING.exec(markdown.replace(/\r\n/g, "\n"));
  return match ? match[1].trim() : null;
}

function linesOf(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").split("\n");
}

/**
 * Parse heading BRD menjadi section tree preorder. `end` mencakup seluruh
 * subtree (sub-heading `###` dst) sampai heading dengan level sama/lebih tinggi.
 */
export function parseBrdSections(markdown: string): BrdSectionNode[] {
  const lines = linesOf(markdown);
  const nodes: BrdSectionNode[] = [];
  const stack: BrdSectionNode[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = HEADING.exec(lines[index]);
    if (!heading) continue;
    const level = heading[1].length;
    while (stack.length && stack[stack.length - 1]!.level >= level) {
      stack.pop()!.end = index;
    }
    const title = heading[2].trim();
    const id = /^((?:BR|FR)-\d+)\b/i.exec(title)?.[1]?.toUpperCase() ?? null;
    const node: BrdSectionNode = {
      id,
      title,
      level,
      chars: 0,
      requirementIds: [],
      start: index,
      end: lines.length,
    };
    stack.push(node);
    nodes.push(node);
  }
  for (const node of nodes) {
    const body = lines.slice(node.start + 1, node.end);
    node.chars = body.join("\n").replace(/\s+/g, " ").trim().length;
    node.requirementIds = body
      .map((line) => REQUIREMENT_HEADING.exec(line.trim())?.[1]?.toUpperCase())
      .filter((value): value is string => Boolean(value));
  }
  return nodes;
}

/**
 * Cari section berdasarkan id atau potongan judul. Bila beberapa cocok, pilih
 * heading paling dangkal agar sub-heading bernama mirip tidak menutupinya.
 */
export function findBrdSection(markdown: string, ref: string): BrdSectionMatch | null {
  const needle = ref.trim().toLowerCase();
  if (!needle) return null;
  const lines = linesOf(markdown);
  let best: BrdSectionNode | null = null;
  for (const node of parseBrdSections(markdown)) {
    const haystack = `${node.id ?? ""} ${node.title}`.toLowerCase();
    if (!haystack.includes(needle)) continue;
    if (!best || node.level < best.level) best = node;
  }
  if (!best) return null;
  return { node: best, content: lines.slice(best.start, best.end).join("\n").trim() };
}

/**
 * Outline ringkas BRD: daftar section (indentasi level), id requirement per
 * section, dan metadata versi. Dipakai mode default get_active_brd agar input
 * model tetap kecil untuk BRD besar.
 */
export function renderBrdOutline(
  markdown: string,
  versions: readonly ActiveBrdVersion[] = [],
  options: { maxChars?: number; maxIdsPerSection?: number } = {},
): string {
  const maxChars = options.maxChars ?? 4000;
  const maxIds = options.maxIdsPerSection ?? 40;
  const lines: string[] = [];
  lines.push(`title: ${brdTitle(markdown) ?? "(tanpa judul)"}`);
  lines.push(`chars: ${markdown.length}`);
  if (versions.length) {
    const latest = versions[versions.length - 1]!;
    lines.push(
      `versions: ${versions.length} (v1..v${latest.versionNumber}, terbaru: ${latest.changeSummary ?? "tanpa ringkasan"})`,
    );
  }
  lines.push("sections:");
  let used = lines.join("\n").length;
  for (const node of parseBrdSections(markdown)) {
    const indent = "  ".repeat(Math.max(0, node.level - 2));
    const label = node.id ? `${node.id} — ${node.title}` : node.title;
    let line = `${indent}${"#".repeat(node.level)} ${label}`;
    if (node.requirementIds.length) {
      const ids = node.requirementIds.slice(0, maxIds).join(", ");
      const more =
        node.requirementIds.length > maxIds
          ? `, +${node.requirementIds.length - maxIds} lainnya`
          : "";
      line += ` [${ids}${more}]`;
    }
    used += line.length + 1;
    if (used > maxChars) {
      lines.push("… (outline dipotong)");
      break;
    }
    lines.push(line);
  }
  return lines.join("\n");
}
