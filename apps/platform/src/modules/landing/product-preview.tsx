import { Check, GitCompareArrows, Sparkles, X } from "lucide-react";
import { LogoMark } from "#/components/brand/logo";

const SESSIONS = [
  { title: "Klarifikasi ruang lingkup", active: true },
  { title: "Revisi FR-007", active: false },
  { title: "Review stakeholder", active: false },
];

/**
 * Mockup statis jendela workspace untuk hero. Murni dekoratif dan tidak
 * dapat difokus, sehingga ditandai aria-hidden bagi pembaca layar.
 */
export function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl" />

      <div className="animate-rise relative overflow-hidden rounded-2xl border bg-card shadow-lifted">
        <div className="flex items-center gap-2 border-b border-border/70 bg-muted/40 px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-destructive/50" />
            <span className="size-2.5 rounded-full bg-warning/60" />
            <span className="size-2.5 rounded-full bg-success/50" />
          </span>
          <LogoMark className="ml-1.5 size-4" />
          <span className="font-display text-[11px] font-semibold">Halodocs</span>
          <span className="ml-auto rounded-full border border-border/70 bg-card px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
            Demo
          </span>
        </div>

        <div className="grid grid-cols-[124px_1fr] sm:grid-cols-[150px_1fr]">
          <aside className="space-y-3 border-r border-border/70 bg-sidebar p-3">
            <div>
              <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                Project
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-1 rounded-lg bg-primary/10 px-2 py-1.5">
                <span className="truncate text-[11px] font-medium text-accent-foreground">
                  Pengajuan Cuti
                </span>
                <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-bold text-primary-foreground">
                  v3
                </span>
              </div>
            </div>

            <div>
              <p className="text-[9px] font-semibold tracking-wider text-muted-foreground uppercase">
                Sesi
              </p>
              <ul className="mt-1.5 space-y-1">
                {SESSIONS.map((session) => (
                  <li
                    key={session.title}
                    className={
                      session.active
                        ? "rounded-md bg-card px-2 py-1.5 text-[10px] font-medium text-foreground shadow-soft"
                        : "px-2 py-1.5 text-[10px] text-muted-foreground"
                    }
                  >
                    <span className="line-clamp-1">{session.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-border/70 bg-card/70 px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground">Template aktif</p>
              <p className="truncate text-[10px] font-medium">BRD Internal v2</p>
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5 border-b border-border/70 px-3 py-2">
              <Sparkles size={11} className="text-primary" />
              <span className="text-[11px] font-semibold">Asisten Analis Sistem</span>
              <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-muted-foreground">
                <span className="size-1.5 rounded-full bg-success" /> BRD v3.0
              </span>
            </div>

            <div className="space-y-2.5 p-3">
              <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-primary px-2.5 py-1.5 text-[10px] leading-4 text-primary-foreground">
                Kami butuh pengajuan cuti dengan approval berjenjang dan notifikasi ke atasan.
              </div>

              <div className="w-fit max-w-[92%] space-y-2 rounded-xl rounded-bl-sm border border-border/70 bg-muted/40 px-2.5 py-2">
                <p className="text-[10px] leading-4">
                  Sebelum menyusun BRD, saya perlu memastikan alur persetujuannya:
                </p>
                <div className="flex flex-wrap gap-1">
                  {["2 level", "3 level", "Berdasarkan nominal"].map((option, index) => (
                    <span
                      key={option}
                      className={
                        index === 0
                          ? "rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-accent-foreground"
                          : "rounded-full border border-border/70 bg-card px-2 py-0.5 text-[9px] text-muted-foreground"
                      }
                    >
                      {option}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-card p-2.5 shadow-soft">
                <div className="flex items-center gap-1.5">
                  <GitCompareArrows size={11} className="text-primary" />
                  <span className="text-[10px] font-semibold">Usulan v4.0 menunggu approval</span>
                </div>
                <div className="mt-2 space-y-1 text-[9px] leading-4">
                  <p className="rounded-md border border-diff-added bg-diff-added px-2 py-1 text-diff-added-foreground">
                    + FR-007 ditambahkan · notifikasi persetujuan
                  </p>
                  <p className="rounded-md border border-diff-removed bg-diff-removed px-2 py-1 text-diff-removed-foreground">
                    − FR-002 dihapus · duplikat validasi
                  </p>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[9px] font-semibold text-primary-foreground">
                    <Check size={9} /> Setujui &amp; Buat v4.0
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[9px] font-medium text-muted-foreground">
                    <X size={9} /> Tolak
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-3 py-1.5 text-[9px] text-muted-foreground">
          <span>BRD v3.0 · Dalam review</span>
          <span>3 dokumen · 12 pesan</span>
        </div>
      </div>
    </div>
  );
}
