export const PAYMENT_STORY = `Staf Finance ingin mengajukan pembayaran vendor melalui sistem.
Pengajuan berisi vendor, nominal, tanggal jatuh tempo, dan lampiran invoice.
Supervisor menyetujui atau menolak; setelah disetujui, Admin Finance memproses pembayaran.
Sistem mencatat riwayat status: DIAJUKAN, DISETUJUI, DITOLAK, DIBAYAR.`;

export const WEAK_STORY = "buatkan fitur login";

export const COMPLETE_ANSWERS: Record<string, string> = {
  q1_1: "Aktor: Staf Finance (mengajukan), Supervisor (menyetujui/menolak), Admin Finance (memproses pembayaran). Staf hanya melihat pengajuan miliknya.",
  q1_2: "Alur utama: Staf membuat pengajuan, sistem validasi, Supervisor approve/reject, Admin menandai dibayar. Penolakan mengembalikan status ke DIAJUKAN dengan catatan.",
  q1_3: "Validasi: nominal > 0, vendor aktif, invoice wajib untuk nominal di atas 10 juta, tanggal jatuh tempo tidak boleh di masa lalu. Kegagalan menampilkan pesan dan dicatat pada log audit.",
  q1_4: "Kriteria penerimaan: diberikan pengajuan valid, ketika Supervisor menyetujui, maka status menjadi DISETUJUI dan notifikasi terkirim; ketika invoice tidak ada untuk nominal di atas 10 juta, maka sistem menolak dengan pesan yang dapat ditindaklanjuti.",
  q1_5: "Setelah DITOLAK, Staf dapat mengedit dan mengirim ulang pengajuan yang sama (status kembali ke DIAJUKAN, versi sebelumnya tersimpan untuk audit). Notifikasi dikirim via email dan in-app. Data vendor diambil dari master data vendor, bukan input bebas. Out-of-scope: eksekusi transfer ke rekening vendor dilakukan di ERP terpisah; sistem ini hanya mencatat nomor pembayaran dan menandai DIBAYAR setelah Admin memprosesnya di ERP.",
};

export const ROUND2_ANSWERS: Record<string, string> = {
  q2_1: "Alternate flow: jika Supervisor tidak merespons 3 hari kerja, sistem mengirim pengingat dan eskalasi ke Head of Finance.",
  q2_2: "Kondisi gagal: vendor nonaktif, invoice tidak terbaca, atau nominal melebihi pagu anggaran.",
  q2_3: "Kriteria berhasil: status akhir DIBAYAR, nomor pembayaran tersimpan, dan notifikasi terkirim ke Staf dan Admin.",
};
