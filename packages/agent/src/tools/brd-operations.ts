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
  // Patch presisi tanpa harus mengenal id FR/BR atau menulis ulang section:
  // ganti potongan teks yang benar-benar ada di BRD.
  z.object({
    op: z.literal("replace_text"),
    find: z.string().min(1),
    content: z.string().min(1),
    occurrence: z.number().int().positive().optional(),
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
/** Heading section (##) maupun sub-section (###) supaya template custom tanpa FR/BR tetap bisa ditarget. */
const SECTION_HEADING = /^(#{2,3})\s+(.*)$/;

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

function sectionInfo(line: string): { level: number; name: string } | null {
  const match = SECTION_HEADING.exec(line);
  if (!match) return null;
  return {
    level: match[1].length,
    name: match[2]
      .replace(/^\d+(?:\.\d+)*\.?\s*/, "")
      .trim()
      .toLowerCase(),
  };
}

/**
 * Cari blok section berdasarkan judul (nomor heading diabaikan). Mendukung
 * `##` dan `###`; blok berakhir di heading berikutnya dengan level sama atau
 * lebih tinggi sehingga sub-section lain tidak ikut tertimpa.
 */
function findSectionBlock(lines: string[], sectionTitle: string): Block | null {
  const needle = sectionTitle.trim().toLowerCase();
  for (let index = 0; index < lines.length; index += 1) {
    const info = sectionInfo(lines[index]);
    if (!info) continue;
    if (info.name.includes(needle) || needle.includes(info.name)) {
      let end = index + 1;
      while (end < lines.length) {
        if (/^#\s+/.test(lines[end])) break;
        const next = sectionInfo(lines[end]);
        if (next && next.level <= info.level) break;
        end += 1;
      }
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
    const info = sectionInfo(lines[index]);
    if (!info || info.level !== 2 || !keywords.test(info.name)) continue;
    let end = index + 1;
    while (end < lines.length) {
      if (/^#\s+/.test(lines[end])) break;
      const next = sectionInfo(lines[end]);
      if (next && next.level <= 2) break;
      end += 1;
    }
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
  texts: number;
}): string {
  const parts: string[] = [];
  if (counts.updated.length) parts.push(`${counts.updated.join(", ")} diperbarui`);
  if (counts.added.length) parts.push(`${counts.added.join(", ")} ditambahkan`);
  if (counts.removed.length) parts.push(`${counts.removed.join(", ")} dihapus`);
  if (counts.sections.length) {
    parts.push(`section ${counts.sections.map((title) => `"${title}"`).join(", ")} diperbarui`);
  }
  if (counts.texts) parts.push(`${counts.texts} potongan teks diperbarui`);
  return parts.length ? `${parts.join("; ")}.` : "Tidak ada perubahan.";
}

function truncate(value: string, max = 60): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
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
    texts: 0,
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

    if (operation.op === "replace_text") {
      const markdown = lines.join("\n");
      let foundAt = -1;
      if (operation.occurrence && operation.occurrence > 1) {
        let searchFrom = 0;
        for (let count = 0; count < operation.occurrence; count += 1) {
          foundAt = markdown.indexOf(operation.find, searchFrom);
          if (foundAt === -1) break;
          searchFrom = foundAt + operation.find.length;
        }
      } else {
        foundAt = markdown.indexOf(operation.find);
        if (foundAt !== -1) {
          const next = markdown.indexOf(operation.find, foundAt + operation.find.length);
          if (next !== -1 && operation.occurrence === undefined) {
            gaps.push(
              `Teks "${truncate(operation.find)}" muncul lebih dari sekali; perjelas konteks atau isi occurrence.`,
            );
            continue;
          }
        }
      }
      if (foundAt === -1) {
        gaps.push(`Teks "${truncate(operation.find)}" tidak ditemukan pada BRD.`);
        continue;
      }
      const updated =
        markdown.slice(0, foundAt) + operation.content.trim() + markdown.slice(foundAt + operation.find.length);
      lines.length = 0;
      lines.push(...splitLines(updated));
      counts.texts += 1;
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
