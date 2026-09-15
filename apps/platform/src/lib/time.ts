const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Waktu relatif ringkas berbahasa Indonesia untuk timestamp ISO. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - now;
  const abs = Math.abs(diff);

  if (abs < 45_000) return "Baru saja";
  if (abs < HOUR) {
    const minutes = Math.round(abs / MINUTE);
    return diff < 0 ? `${minutes} menit lalu` : `dalam ${minutes} menit`;
  }
  if (abs < DAY) {
    const hours = Math.round(abs / HOUR);
    return diff < 0 ? `${hours} jam lalu` : `dalam ${hours} jam`;
  }
  if (abs < 30 * DAY) {
    const days = Math.round(abs / DAY);
    return diff < 0 ? `${days} hari lalu` : `dalam ${days} hari`;
  }
  return new Date(then).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
