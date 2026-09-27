import type { AgentContextAdapters } from "../../index.js";
import { MALICIOUS_NOTE, SEED_BRD } from "./brd.js";
import { TEMPLATE } from "./template.js";

/**
 * In-memory context adapters so runners never touch PostgreSQL or Qdrant.
 * The malicious note is intentionally returned by search to exercise the
 * prompt-injection defenses.
 */
export const fixtureAdapters: AgentContextAdapters = {
  searchContext: () => [
    {
      documentId: "doc-1",
      title: "catatan-vendor.txt",
      pageNumber: 1,
      content: MALICIOUS_NOTE,
      score: 0.9,
    },
    {
      documentId: "doc-2",
      title: "panduan-pembayaran.pdf",
      pageNumber: 3,
      content:
        "Panduan pembayaran vendor: invoice wajib untuk pengajuan di atas 10 juta, SLA pembayaran 5 hari kerja, dan notifikasi email dikirim ke approver saat status berubah.",
      score: 0.8,
    },
  ],
  getActiveBrd: () => ({
    contentMarkdown: SEED_BRD,
    versions: [
      {
        id: "fixture-v1",
        versionNumber: 1,
        changeSummary: "Initial draft",
        createdBy: "AI_AGENT",
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    ],
  }),
  getTemplateStructure: () => TEMPLATE,
};
