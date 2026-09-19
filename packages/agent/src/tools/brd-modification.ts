import { createTool } from "@anvia/core";
import { z } from "zod";
import { contextAdapters, type AgentContextAdapters } from "./context.js";
import {
  applyOperations,
  BrdOperationSchema,
  type BrdOperation,
  type ApplyOperationsResult,
} from "./brd-operations.js";

/**
 * Convert a free-text change request into a structured operation. Kept as a
 * fallback for models that do not emit `operations`; prefer the structured path.
 */
export function applyChange(brd: string, changeRequest: string): ApplyOperationsResult {
  const normalized = changeRequest.trim();
  const removeMatch = normalized.match(/(?:remove|delete|hapus)\s+((?:FR|BR)-\d+)/i);
  if (removeMatch) {
    return applyOperations(brd, [{ op: "remove", requirementId: removeMatch[1] }]);
  }

  const explicitId = normalized.match(/\b(?:FR|BR)-\d+\b/i)?.[0]?.toUpperCase();
  if (explicitId) {
    const exists = new RegExp(`^###\\s+${explicitId}\\s*$`, "im").test(brd);
    if (exists) {
      return applyOperations(brd, [
        { op: "update", requirementId: explicitId, content: normalized },
      ]);
    }
    return applyOperations(brd, [{ op: "add", requirementId: explicitId, content: normalized }]);
  }
  return applyOperations(brd, [{ op: "add", content: normalized }]);
}

export const MODIFY_BRD_DESCRIPTION =
  "Apply explicit changes to a BRD (add/update/remove requirements, replace a section or sub-section body, or replace an exact text snippet).";

const STATIC_MODIFY_DESCRIPTION = `${MODIFY_BRD_DESCRIPTION} Pass the BRD markdown in \`brd\`.`;

const ACTIVE_MODIFY_DESCRIPTION = `${MODIFY_BRD_DESCRIPTION} The active BRD is resolved automatically server-side; send ONLY operations and, optionally, short reference context — never send the document itself.`;

const modifyBrdInputSchema = z.object({
  brd: z.string().min(1).describe("BRD markdown to modify."),
  operations: z.array(BrdOperationSchema).max(20).default([]),
  changeRequest: z.string().default(""),
  referenceContext: z.string().default(""),
});

/**
 * Saat adapter konteks tersedia, dokumen aktif diambil server-side dan field
 * `brd` sengaja TIDAK ada di schema — mencegah model menyalin seluruh BRD ke
 * argumen tool (streaming puluhan ribu token = lambat).
 */
const activeBrdModifyInputSchema = z.object({
  operations: z.array(BrdOperationSchema).max(20).default([]),
  changeRequest: z.string().default(""),
  referenceContext: z.string().default(""),
});

function buildOutput(
  result: ApplyOperationsResult,
  referenceContext: string,
): {
  updatedMarkdown: string | null;
  changeSummary: string;
  affectedIds: string[];
  gaps: string[];
  applied: number;
  groundedByReference: boolean;
  persisted: false;
  userNotice: string;
} {
  const userNotice =
    result.applied > 0
      ? "BRD berhasil dimodifikasi sebagai pratinjau. Review perubahan di panel BRD, lalu approve untuk menyimpan versi baru."
      : `Tidak ada perubahan yang dapat diterapkan. ${result.gaps.join(" ")}`.trim();

  return {
    updatedMarkdown: result.applied > 0 ? result.updatedMarkdown : null,
    changeSummary: result.changeSummary,
    affectedIds: result.affectedIds,
    gaps: result.gaps,
    applied: result.applied,
    groundedByReference: Boolean(referenceContext.trim()),
    persisted: false as const,
    userNotice,
  };
}

/** Tool statis tanpa adapter: pemanggil wajib mengirim markdown BRD. */
export const modifyBrdTool = createTool({
  name: "modify_brd",
  description: STATIC_MODIFY_DESCRIPTION,
  inputSchema: modifyBrdInputSchema,
  execute: async ({ brd, operations, changeRequest, referenceContext }) => {
    const result =
      operations.length > 0
        ? applyOperations(brd, operations as BrdOperation[])
        : applyChange(brd, changeRequest);
    return buildOutput(result, referenceContext);
  },
});

/** Tool dengan adapter konteks: dokumen aktif selalu diambil server-side. */
export function createModifyBrdTool(adapters: AgentContextAdapters = {}) {
  const resolved = contextAdapters(adapters);
  return createTool({
    name: "modify_brd",
    description: ACTIVE_MODIFY_DESCRIPTION,
    inputSchema: activeBrdModifyInputSchema,
    execute: async ({ operations, changeRequest, referenceContext }) => {
      const markdown = (await resolved.getActiveBrd({}))?.contentMarkdown ?? "";
      if (!markdown.trim()) {
        return {
          updatedMarkdown: null,
          changeSummary: "Tidak ada perubahan.",
          affectedIds: [],
          gaps: ["BRD aktif tidak ditemukan."],
          applied: 0,
          groundedByReference: Boolean(referenceContext.trim()),
          persisted: false as const,
          userNotice: "Tidak ada BRD aktif yang bisa dimodifikasi.",
        };
      }
      const result =
        operations.length > 0
          ? applyOperations(markdown, operations as BrdOperation[])
          : applyChange(markdown, changeRequest);
      return buildOutput(result, referenceContext);
    },
  });
}

export { applyOperations } from "./brd-operations.js";
export type { BrdOperation, ApplyOperationsResult } from "./brd-operations.js";
