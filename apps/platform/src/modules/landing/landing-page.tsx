import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Info,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Logo, LogoMark } from "#/components/brand/logo";
import { APP_NAME, APP_TAGLINE } from "#/lib/copy";
import {
  FAQS,
  FEATURE_GROUPS,
  STEPS,
  TRUST_POINTS,
  WORKFLOW_POINTS,
} from "#/modules/landing/landing-content";
import { ProductPreview } from "#/modules/landing/product-preview";

const NAV_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#cara-pakai", label: "Cara pakai" },
  { href: "#faq", label: "FAQ" },
];

const PRIMARY_BUTTON =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const SECONDARY_BUTTON =
  "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#konten"
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-soft transition-transform focus:translate-y-0"
      >
        Lewati ke konten
      </a>

      <SiteHeader />

      <main id="konten">
        <Hero />
        <Workflow />
        <Features />
        <HowTo />
        <Faq />
        <FinalCta />
      </main>

      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link
          to="/"
          aria-label={`${APP_NAME} — beranda`}
          className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Logo />
        </Link>

        <nav aria-label="Navigasi halaman" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <Link to="/workspace" className={PRIMARY_BUTTON}>
          Buka workspace <ArrowRight size={16} />
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="surface-grid relative overflow-hidden border-b border-border/60">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary/5 to-transparent"
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-info/30 bg-info/10 px-3 py-1 text-xs font-medium text-info">
            <Sparkles size={12} /> Asisten Analis Sistem
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Dari user story menjadi <span className="text-gradient-brand">BRD siap review</span>,
            tanpa kerja berulang.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            {APP_NAME} menyusun BRD mengikuti template perusahaan, menanyakan hal yang benar-benar
            penting, mencatat asumsi dan GAP secara eksplisit, lalu menyimpannya lewat alur
            persetujuan yang bisa diaudit.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/workspace" className={PRIMARY_BUTTON}>
              Buka workspace <ArrowRight size={16} />
            </Link>
            <a href="#cara-pakai" className={SECONDARY_BUTTON}>
              Lihat cara pakai
            </a>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            {TRUST_POINTS.map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-success" /> {item}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function Workflow() {
  return (
    <section className="border-b border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h2 className="font-display text-sm font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Satu alur, dari cerita ke dokumen
        </h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {WORKFLOW_POINTS.map((point, index) => {
            const Icon = point.icon;
            return (
              <li key={point.title} className="rounded-xl border bg-card p-3 shadow-soft">
                <div className="flex items-center justify-between">
                  <Icon size={15} className="text-primary" />
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <p className="mt-2 font-display text-sm font-semibold">{point.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{point.caption}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      id="fitur"
      aria-labelledby="fitur-title"
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20"
    >
      <SectionHeading
        id="fitur-title"
        eyebrow="Fitur"
        icon={LayoutTemplate}
        title="Yang bisa dilakukan Halodocs"
        description="Menutup siklus sebelum coding: dari dokumen mentah sampai BRD yang bisa dipertanggungjawabkan — tanpa kehilangan kendali atas isinya."
      />

      <div className="mt-10 space-y-12">
        {FEATURE_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.id}>
              <div className="flex items-start gap-3 border-b border-border/70 pb-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <GroupIcon size={17} />
                </span>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-semibold">{group.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {group.description}
                  </p>
                </div>
                <span className="ml-auto hidden shrink-0 pt-1 text-xs text-muted-foreground sm:block">
                  {group.features.length} fitur
                </span>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {group.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <article
                      key={feature.title}
                      className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-soft transition-colors hover:border-primary/30"
                    >
                      <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Icon size={16} />
                      </span>
                      <h4 className="mt-3 font-display text-sm font-semibold">{feature.title}</h4>
                      <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                        {feature.body}
                      </p>
                      <span className="mt-3 inline-flex w-fit items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {feature.meta}
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function HowTo() {
  return (
    <section
      id="cara-pakai"
      aria-labelledby="cara-title"
      className="scroll-mt-20 border-y border-border/60 bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <SectionHeading
          id="cara-title"
          eyebrow="Cara pakai"
          icon={ShieldCheck}
          title="Enam langkah, tanpa latihan panjang"
          description="Ikuti alur berikut dari workspace. Tiap langkah mencantumkan batasan penting agar tidak ada kejutan di tengah proses."
        />

        <ol className="mt-10 grid gap-5 lg:grid-cols-2">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-2xl border bg-card p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <Icon size={16} className="shrink-0 text-primary" />
                  <h3 className="font-display text-base font-semibold">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{step.body}</p>
                <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  <Info size={13} className="mt-0.5 shrink-0 text-info" />
                  <span>{step.note}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="mx-auto max-w-6xl scroll-mt-20 px-5 py-16 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
        <SectionHeading
          id="faq-title"
          eyebrow="FAQ"
          icon={Info}
          title="Pertanyaan yang sering muncul"
          description="Jawaban singkat dan jujur tentang cakupan, batasan, serta cara kerja asisten."
        />

        <div className="divide-y divide-border rounded-2xl border bg-card shadow-soft">
          {FAQS.map((item) => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium [&::-webkit-details-marker]:hidden">
                <span>{item.question}</span>
                <ChevronDown
                  size={16}
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-20">
      <div className="relative overflow-hidden rounded-3xl border bg-card px-6 py-10 text-center shadow-soft sm:px-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-primary/10 blur-3xl"
        />
        <div className="relative">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Mulai BRD pertama Anda
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Siapkan template, buat project, dan biarkan asisten menyusun draf — Anda tetap pemegang
            keputusan di setiap perubahan.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/workspace" className={PRIMARY_BUTTON}>
              Buka workspace <ArrowRight size={16} />
            </Link>
            <a href="#fitur" className={SECONDARY_BUTTON}>
              Jelajahi fitur
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-xs leading-5 text-muted-foreground">
              {APP_TAGLINE} yang mengubah user story menjadi BRD siap review — mengikuti template
              perusahaan, dengan klarifikasi terarah dan persetujuan yang bisa diaudit.
            </p>
          </div>

          <nav aria-label="Navigasi produk">
            <p className="text-xs font-semibold tracking-wider text-foreground uppercase">Produk</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Navigasi akses">
            <p className="text-xs font-semibold tracking-wider text-foreground uppercase">Mulai</p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>
                <Link
                  to="/workspace"
                  className="transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Buka workspace
                </Link>
              </li>
              <li>
                <a
                  href="#cara-pakai"
                  className="transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Panduan penggunaan
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="size-5" />
            {APP_NAME} — dibuat untuk System Analyst.
          </span>
          <span>
            Model &amp; kredensial default dikelola server; dapat diubah per akun di Pengaturan.
          </span>
        </div>
      </div>
    </footer>
  );
}

function SectionHeading({
  id,
  eyebrow,
  icon: Icon,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
        <Icon size={13} /> {eyebrow}
      </span>
      <h2
        id={id}
        className="mt-3 font-display text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
      >
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}
