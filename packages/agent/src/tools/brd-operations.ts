import { z } from "zod";

export const BrdOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    requirementId: z
      .string()
      .regex(/^(FR|BR)-\d+$/i)
      .optional(),
    title: z.string().min(1).optional(),
    content: z.string().min(1),
    sectionTitle: z.string().min(1).optional(),
  }),
  z.object({
    op: z.literal("update"),
    requirementId: z.string().regex(/^(FR|BR)-\d+$/i),
    content: z.string().min(1),
  }),
  z.object({
    op: z.literal("remove"),
    requirementId: z.string().regex(/^(FR|BR)-\d+$/i),
  }),
  z.object({
    op: z.literal("update_section"),
    sectionTitle: z.string().min(1),
    content: z.string().min(1),
  }),
]);

export type BrdOperation = z.infer<typeof BrdOperationSchema>;

/**
 * Drop any agent preamble or closing note so the stored document starts at the
 * BRD title. The prompt asks for pure markdown, but models occasionally wrap it
 * with conversational prose; the stored artefact must stay a clean document.
 */
export function extractBrdDocument(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = /(^|\n)#\s+BRD\b/i.exec(normalized);
  if (!match) return normalized.trim();
  const start = match[1] === "\n" ? match.index + 1 : match.index;
  return normalized.slice(start).trim();
}

export type ApplyOperationsResult = {
  ok: boolean;
  applied: number;
  updatedMarkdown: string;
  affectedIds: string[];
  gaps: string[];
  changeSummary: string;
};

const REQUIREMENT_HEADING = /^###\s+((?:FR|BR)-\d+)\s*$/i;
const SECTION_HEADING = /^##\s+(.*)$/;

type Block = { start: number; end: number };

function splitLines(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").split("\n");
}

function findRequirementBlock(lines: string[], requirementId: string): Block | null {
  const target = requirementId.toUpperCase();
  for (let index = 0; index < lines.length; index += 1) {
    const match = REQUIREMENT_HEADING.exec(lines[index].trim());
    if (!match || match[1].toUpperCase() !== target) continue;
    let end = index + 1;
    while (end < lines.length && !/^#{1,3}\s+/.test(lines[end])) end += 1;
    return { start: index, end };
  }
  return null;
}

function sectionName(line: string): string | null {
  const match = SECTION_HEADING.exec(line);
  if (!match) return null;
  return match[1]
    .replace(/^\d+\.\s*/, "")
    .trim()
    .toLowerCase();
}

function findSectionBlock(lines: string[], sectionTitle: string): Block | null {
  const needle = sectionTitle.trim().toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    const name = sectionName(lines[index]);
    if (name === null) continue;
    if (name.includes(needle) || needle.includes(name)) {
      let end = index + 1;
      while (end < lines.length && !SECTION_HEADING.test(lines[end])) end += 1;
      return { start: index, end };
    }
  }
  return null;
}

function requirementPrefix(requirementId: string): "FR" | "BR" {
  return requirementId.toUpperCase().startsWith("BR") ? "BR" : "FR";
}

function nextRequirementId(lines: string[], prefix: "FR" | "BR"): string {
  const pattern = new RegExp(`\\b${prefix}-(\\d+)\\b`, "gi");
  let max = 0;
  for (const line of lines) {
    for (const match of line.matchAll(pattern)) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function sectionForPrefix(lines: string[], prefix: "FR" | "BR"): Block | null {
  const keywords = prefix === "FR" ? /functional|fungsional/i : /business|bisnis|aturan/i;
  for (let index = 0; index < lines.length; index += 1) {
    const name = sectionName(lines[index]);
    if (name === null || !keywords.test(name)) continue;
    let end = index + 1;
    while (end < lines.length && !SECTION_HEADING.test(lines[end])) end += 1;
    return { start: index, end };
  }
  return null;
}

function trimTrailingBlanks(lines: string[], from: number, end: number): number {
  let last = end;
  while (last > from && lines[last - 1] !== undefined && lines[last - 1].trim() === "") last -= 1;
  return last;
}

function normalizeLines(lines: string[]): string[] {
  const output: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    if (
      !inFence &&
      line.trim() === "" &&
      output.length > 0 &&
      output[output.length - 1]!.trim() === ""
    ) {
      continue;
    }
    output.push(line);
  }
  while (output.length > 0 && output[0]!.trim() === "") output.shift();
  while (output.length > 0 && output[output.length - 1]!.trim() === "") output.pop();
  return output;
}

function operationSummary(counts: {
  added: string[];
  updated: string[];
  removed: string[];
  sections: string[];
}): string {
  const parts: string[] = [];
  if (counts.updated.length) parts.push(`${counts.updated.join(", ")} diperbarui`);
  if (counts.added.length) parts.push(`${counts.added.join(", ")} ditambahkan`);
  if (counts.removed.length) parts.push(`${counts.removed.join(", ")} dihapus`);
  if (counts.sections.length) {
    parts.push(`section ${counts.sections.map((title) => `"${title}"`).join(", ")} diperbarui`);
  }
  return parts.length ? `${parts.join("; ")}.` : "Tidak ada perubahan.";
}

export function applyOperations(
  brd: string,
  operations: readonly BrdOperation[],
): ApplyOperationsResult {
  const lines = splitLines(brd);
  const gaps: string[] = [];
  const affectedIds: string[] = [];
  const counts = {
    added: [] as string[],
    updated: [] as string[],
    removed: [] as string[],
    sections: [] as string[],
  };
  let applied = 0;

  for (const operation of operations) {
    if (operation.op === "update") {
      const block = findRequirementBlock(lines, operation.requirementId);
      if (!block) {
        gaps.push(`${operation.requirementId.toUpperCase()} tidak ditemukan pada BRD.`);
        continue;
      }
      lines.splice(block.start + 1, block.end - block.start - 1, "", operation.content.trim());
      const id = operation.requirementId.toUpperCase();
      affectedIds.push(id);
      counts.updated.push(id);
      applied += 1;
      continue;
    }

    if (operation.op === "remove") {
      const block = findRequirementBlock(lines, operation.requirementId);
      if (!block) {
        gaps.push(`${operation.requirementId.toUpperCase()} tidak ditemukan pada BRD.`);
        continue;
      }
      lines.splice(block.start, block.end - block.start);
      const id = operation.requirementId.toUpperCase();
      affectedIds.push(id);
      counts.removed.push(id);
      applied += 1;
      continue;
    }

    if (operation.op === "update_section") {
      const block = findSectionBlock(lines, operation.sectionTitle);
      if (!block) {
        gaps.push(`Section "${operation.sectionTitle}" tidak ditemukan pada BRD.`);
        continue;
      }
      lines.splice(block.start + 1, block.end - block.start - 1, "", operation.content.trim());
      counts.sections.push(operation.sectionTitle);
      applied += 1;
      continue;
    }

    const explicitId = operation.requirementId?.toUpperCase();
    if (explicitId && findRequirementBlock(lines, explicitId)) {
      gaps.push(`${explicitId} sudah ada; gunakan operasi update.`);
      continue;
    }
    const prefix = explicitId ? requirementPrefix(explicitId) : "FR";
    const id = explicitId ?? nextRequirementId(lines, prefix);
    const body = [
      `### ${id}`,
      operation.title ? `**${operation.title}**` : null,
      "",
      operation.content.trim(),
      "",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");

    const section = operation.sectionTitle
      ? findSectionBlock(lines, operation.sectionTitle)
      : sectionForPrefix(lines, prefix);
    if (section) {
      const insertAt = trimTrailingBlanks(lines, section.start + 1, section.end);
      lines.splice(insertAt, 0, "", ...body.split("\n"));
    } else {
      const title = prefix === "BR" ? "Business requirements" : "Functional requirements";
      lines.push("", `## ${title}`, "", ...body.split("\n"));
    }
    affectedIds.push(id);
    counts.added.push(id);
    applied += 1;
  }

  const updatedMarkdown = `${normalizeLines(lines).join("\n")}\n`;
  return {
    ok: applied > 0 && gaps.length === 0,
    applied,
    updatedMarkdown,
    affectedIds: [...new Set(affectedIds)],
    gaps,
    changeSummary: operationSummary(counts),
  };
}
