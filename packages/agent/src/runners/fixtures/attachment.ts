export const REFERENCE_DOC = {
  id: "doc-ref-1",
  title: "panduan-pembayaran.pdf",
  pages: [
    {
      pageNumber: 1,
      content:
        "Panduan pembayaran vendor: invoice wajib untuk pengajuan di atas 10 juta, SLA pembayaran 5 hari kerja setelah invoice diverifikasi, dan notifikasi email dikirim ke approver saat status pengajuan berubah.",
    },
    {
      pageNumber: 3,
      content:
        "Eskalasi keterlambatan: jika pembayaran melewati SLA 5 hari kerja, Admin Finance wajib mengirim laporan mingguan ke manajer keuangan.",
    },
  ],
};

/**
 * Mirror of attachmentContextBlock in apps/api/src/modules/chat/services.ts.
 * Keep the format in sync so the runner exercises the same prompt shape the
 * chat router injects for mentioned/attached documents.
 */
export function attachmentBlockFor(doc: typeof REFERENCE_DOC = REFERENCE_DOC): string {
  const blocks = doc.pages.map(
    (page) => `### File: ${doc.title} (halaman ${page.pageNumber})\n${page.content}`,
  );
  return [
    "[Konten file sesi yang dirujuk user — jadikan sumber utama, jangan bilang tidak punya akses:",
    blocks.join("\n\n"),
    "Gunakan search_context bila butuh bagian lain dari file tersebut.]",
  ].join("\n");
}

export function referenceDocSearchResults() {
  return REFERENCE_DOC.pages.map((page) => ({
    documentId: REFERENCE_DOC.id,
    title: REFERENCE_DOC.title,
    pageNumber: page.pageNumber,
    content: page.content,
    score: 0.9,
  }));
}
