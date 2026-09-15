import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AtSign,
  CheckCircle2,
  Download,
  FileText,
  GitCompareArrows,
  History,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo, LogoMark } from "#/components/brand/logo";
import { SettingsDialog } from "#/modules/settings/settings-page";
import { APP_NAME, APP_TAGLINE } from "#/lib/copy";

export const Route = createFileRoute("/")({ component: Landing });

const FEATURES = [
  {
    icon: LayoutTemplate,
    title: "Mengikuti standar perusahaan",
    body: "Unggah template BRD sekali; strukturnya diekstrak, Anda review, lalu dipakai konsisten untuk semua draft berikutnya.",
  },
  {
    icon: Sparkles,
    title: "Klarifikasi terarah",
    body: "Tanpa asumsi diam-diam. Ambiguitas penting muncul sebagai pertanyaan fokus (maks 2 putaran) sebelum dokumen ditulis.",
  },
  {
    icon: FileText,
    title: "BRD lengkap dan ter-grounding",
    body: "User story menjadi BRD dengan BR-/FR-, alur mermaid, kriteria penerimaan, asumsi, dan GAP yang eksplisit.",
  },
  {
    icon: GitCompareArrows,
    title: "Review berbasis diff",
    body: "Setiap perubahan dari agen tampil sebagai pratinjau dengan diff — setujui atau tolak sebelum menjadi versi baru.",
  },
  {
    icon: History,
    title: "Riwayat versi",
    body: "Semua snapshot tersimpan sebagai versi. Bandingkan antar versi dan pulihkan kapan saja tanpa kehilangan riwayat.",
  },
  {
    icon: Download,
    title: "Export MD & PDF",
    body: "Bawa dokumen keluar aplikasi: Markdown untuk repo, PDF rapi dengan status dan nomor halaman untuk stakeholder.",
  },
  {
    icon: AtSign,
    title: "Konteks dari file sesi",
    body: "Sebut file dengan @ atau lampirkan dokumen — isinya (termasuk OCR gambar) menjadi sumber jawaban agen.",
  },
  {
    icon: ShieldCheck,
    title: "Human-in-the-loop",
    body: "Status dokumen Draft → Dalam review → Disetujui dengan jejak persetujuan. Agen tidak pernah menyimpan perubahan sendiri.",
  },
];

const STEPS = [
  [
    "Buka workspace",
    "Mulai percakapan baru dari sidebar, lalu pilih mau generate dari user story atau impor BRD lama.",
  ],
  [
    "Jelaskan kebutuhan",
    "Tulis user story atau lampirkan dokumen referensi sebagai konteks grounding.",
  ],
  [
    "Jawab klarifikasi",
    "Pilih opsi atau tulis jawaban sendiri — maksimal 2 putaran, atau lanjut dengan asumsi eksplisit.",
  ],
  [
    "Review perubahan",
    "Setiap modifikasi muncul sebagai pratinjau + diff. Setujui untuk membuat versi baru.",
  ],
  [
    "Setujui & export",
    "Ajukan review, setujui dokumen, lalu unduh Markdown atau PDF siap dibagikan.",
  ],
];

function Landing() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="mr-1 hidden text-xs text-muted-foreground sm:block">
              {APP_TAGLINE}
            </span>
            <SettingsDialog />
            <Link
              to="/workspace"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
            >
              Buka workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="surface-grid border-b border-border/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <span className="mb-4 inline-flex w-fit items-center rounded-full bg-info/15 px-2.5 py-0.5 text-xs font-medium text-info">
              Untuk System Analyst
            </span>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
              Dari user story menjadi <span className="text-gradient-brand">BRD siap review</span>,
              tanpa kerja berulang.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {APP_NAME} menyusun BRD sesuai standar perusahaan, menanyakan hal yang benar-benar
              penting, mencatat asumsi dan GAP secara eksplisit, lalu menyimpannya lewat alur
              persetujuan yang bisa diaudit.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/workspace"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90"
              >
                <FileText size={16} /> Mulai BRD baru
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent"
              >
                Lihat cara kerja <ArrowRight size={16} />
              </a>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {[
                "Template perusahaan",
                "Klarifikasi maks 2 putaran",
                "Approval + audit",
                "Export MD/PDF",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-success" /> {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative hidden lg:block">
            <div
              className="absolute -inset-4 rounded-3xl bg-primary/10 blur-2xl"
              aria-hidden="true"
            />
            <div className="animate-rise relative rounded-2xl border bg-card p-5 shadow-lifted">
              <div className="flex items-center gap-3">
                <LogoMark className="size-9" />
                <div>
                  <p className="font-display text-sm font-semibold">BRD — Pengajuan Cuti</p>
                  <p className="text-xs text-muted-foreground">v3 · Dalam review</p>
                </div>
                <span className="ml-auto inline-flex w-fit items-center rounded-full bg-warning/20 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                  Pratinjau
                </span>
              </div>
              <div className="mt-4 space-y-2 text-xs">
                <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-foreground">
                  + FR-007 ditambahkan · notifikasi persetujuan
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-foreground">
                  − FR-002 dihapus · duplikat validasi
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-muted-foreground">
                  Setujui untuk membuat versi baru, atau tolak untuk membuang pratinjau.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-2xl font-semibold">Apa yang bisa dilakukan</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Menutup siklus sebelum coding: dari dokumen mentah sampai BRD yang bisa
          dipertanggungjawabkan.
        </p>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="rounded-2xl border bg-card p-5 shadow-soft transition-transform hover:-translate-y-0.5"
            >
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon size={18} />
              </div>
              <h3 className="font-display font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="border-y border-border/60 bg-muted/30">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-display text-2xl font-semibold">Cara pakai</h2>
          <ol className="mt-7 grid gap-4 lg:grid-cols-5">
            {STEPS.map(([title, body], index) => (
              <li key={title} className="rounded-2xl border bg-card p-4 shadow-soft">
                <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="mt-3 font-display text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 py-10 text-center text-xs text-muted-foreground">
        <Logo markClassName="size-6" />
        <p>
          {APP_NAME} — {APP_TAGLINE}. Model & kredensial AI dikelola server; tidak ada yang perlu
          dikonfigurasi.
        </p>
      </footer>
    </main>
  );
}
