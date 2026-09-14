const STATUS_MESSAGES: Record<string, string> = {
  "400": "Permintaan tidak valid. Periksa kembali isian Anda.",
  "401": "Sesi tidak dikenal. Muat ulang halaman lalu coba lagi.",
  "403": "Anda tidak memiliki akses untuk tindakan ini.",
  "404": "Data yang diminta tidak ditemukan.",
  "409": "Terjadi konflik data. Muat ulang halaman lalu coba lagi.",
  "413": "Berkas melebihi batas ukuran yang diizinkan.",
  "415": "Tipe berkas tidak didukung.",
  "429": "Terlalu banyak permintaan. Coba lagi sebentar.",
  "500": "Terjadi kesalahan pada server.",
  "503": "Layanan sedang sibuk. Coba lagi sebentar.",
};

/** Turn API/client errors into a short, user-facing Indonesian message. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    const detail = cause as { error?: unknown };
    if (typeof detail.error === "string" && detail.error.trim()) return detail.error;
  }
  const status = /\((\d{3})\)/.exec(error.message)?.[1];
  if (status) return STATUS_MESSAGES[status] ?? error.message;
  return error.message;
}
