import { prisma } from "../../lib/prisma.js";
import { canStageModification } from "./flow-utils.js";

export type StageModificationResult =
  | { ok: true; status: "staged" }
  | {
      ok: false;
      reason: "pending_exists";
      pendingChangeSummary: string | null;
      pendingContentMarkdown: string;
    }
  | { ok: false; reason: "not_found" };

/**
 * Simpan perubahan BRD sebagai pending preview. Dipisah dari services.ts agar
 * adapter agent (modules/chat) bisa memanggilnya tanpa circular import.
 */
export async function stageBrdModification(
  userId: string,
  id: string,
  contentMarkdown: string,
  changeSummary: string,
): Promise<StageModificationResult> {
  const brd = await prisma.brdDocument.findFirst({ where: { id, userId } });
  if (!brd) return { ok: false, reason: "not_found" };
  const decision = canStageModification(brd.pendingContentMarkdown, contentMarkdown);
  if (decision === "conflict") {
    return {
      ok: false,
      reason: "pending_exists",
      pendingChangeSummary: brd.pendingChangeSummary,
      pendingContentMarkdown: brd.pendingContentMarkdown ?? "",
    };
  }
  if (decision === "noop") return { ok: true, status: "staged" };
  // A staged change puts the document under review; reject restores the
  // status the user had before the preview appeared.
  await prisma.brdDocument.update({
    where: { id },
    data: {
      pendingContentMarkdown: contentMarkdown,
      pendingChangeSummary: changeSummary,
      statusBeforePending: brd.statusBeforePending ?? brd.status,
      status: "IN_REVIEW",
    },
  });
  return { ok: true, status: "staged" };
}
