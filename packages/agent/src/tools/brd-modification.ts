import { createTool } from "@anvia/core";
import { z } from "zod";
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

export const modifyBrdTool = createTool({
  name: "modify_brd",
  description:
    "Apply explicit, structured changes (add/update/remove requirements or replace a section body) to an existing BRD without losing unaffected content.",
  inputSchema: z.object({
    brd: z.string().min(1),
    operations: z.array(BrdOperationSchema).max(20).default([]),
    changeRequest: z.string().default(""),
    referenceContext: z.string().default(""),
  }),
  execute: async ({ brd, operations, changeRequest, referenceContext }) => {
    const result: ApplyOperationsResult =
      operations.length > 0
        ? applyOperations(brd, operations as BrdOperation[])
        : applyChange(brd, changeRequest);

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
  },
});

export { applyOperations } from "./brd-operations.js";
export type { BrdOperation, ApplyOperationsResult } from "./brd-operations.js";
