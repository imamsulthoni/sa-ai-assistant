import { createTool } from "@anvia/core";
import { z } from "zod";

const requirementId = /\b(?:FR|BR)-\d+\b/gi;

function applyChange(brd: string, changeRequest: string): { markdown: string; affectedIds: string[] } {
  const ids = [...changeRequest.matchAll(requirementId)].map((match) => match[0].toUpperCase());
  const affectedIds = [...new Set([...brd.matchAll(requirementId)].map((match) => match[0].toUpperCase()).concat(ids))];
  const normalized = changeRequest.trim();
  const removeMatch = normalized.match(/(?:remove|delete|hapus)\s+((?:FR|BR)-\d+)/i);

  if (removeMatch) {
    const target = removeMatch[1].toUpperCase();
    const lines = brd.split("\n");
    const start = lines.findIndex((line) => new RegExp(`^###\\s+${target}\\s*$`, "i").test(line.trim()));
    if (start >= 0) {
      const end = lines.findIndex((line, index) => index > start && /^###\s+(?:FR|BR)-\d+\s*$/i.test(line.trim()));
      lines.splice(start, (end >= 0 ? end : lines.length) - start);
      return { markdown: lines.join("\n").trimEnd() + "\n", affectedIds };
    }
  }

  const explicitId = normalized.match(/\b(?:FR|BR)-\d+\b/i)?.[0]?.toUpperCase();
  const existingNumbers = [...brd.matchAll(/\bFR-(\d+)\b/gi)].map((match) => Number(match[1]));
  const nextId = String(Math.max(0, ...existingNumbers) + 1).padStart(3, "0");
  const target = explicitId ?? `FR-${nextId}`;
  const section = `### ${target}\n${normalized}`;
  const heading = /^##\s+(?:\d+\.\s*)?Functional requirements\s*$/im;
  const headingMatch = heading.exec(brd);
  if (headingMatch) {
    const insertAt = headingMatch.index + headingMatch[0].length;
    return {
      markdown: `${brd.slice(0, insertAt)}\n\n${section}${brd.slice(insertAt)}`.trimEnd() + "\n",
      affectedIds: [...new Set([...affectedIds, target])],
    };
  }
  return {
    markdown: `${brd.trimEnd()}\n\n## Functional requirements\n\n${section}\n`,
    affectedIds: [...new Set([...affectedIds, target])],
  };
}

export const modifyBrdTool = createTool({
  name: "modify_brd",
  description: "Apply a requested addition, change, or removal to an existing BRD.",
  inputSchema: z.object({
    brd: z.string().min(1),
    changeRequest: z.string().min(1),
    referenceContext: z.string().default(""),
  }),
  execute: async ({ brd, changeRequest, referenceContext }) => {
    const result = applyChange(brd, changeRequest);
    return {
      updatedMarkdown: result.markdown,
      changeSummary: `Applied requested BRD change for ${result.affectedIds.join(", ") || "the document"}.`,
      affectedIds: result.affectedIds,
      groundedByReference: Boolean(referenceContext.trim()),
      persisted: false as const,
    };
  },
});

export { applyChange };
