import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  GitCompareArrows,
  Menu,
  MessageSquareText,
  Moon,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Logo } from "#/components/brand/logo";
import { Modal } from "#/components/base/modal";
import { useAuth } from "#/modules/auth/auth-context";
import { AuthPanel, type AuthMode } from "#/modules/auth/auth-panel";
import { UserMenu } from "#/modules/auth/user-menu";
import { APP_NAME, APP_TAGLINE } from "#/lib/copy";
import { FAQS } from "#/modules/landing/landing-content";

type PreviewMode = "draft" | "clarify" | "review";
type LandingTheme = "light" | "dark";

const LANDING_THEME_KEY = "halodocs-landing-theme";

const NAV_LINKS = [
  { href: "#preview", label: "Pratinjau" },
  { href: "#method", label: "Metode" },
  { href: "#faq", label: "FAQ" },
];

export function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<LandingTheme>(() =>
    typeof window !== "undefined" && window.localStorage.getItem(LANDING_THEME_KEY) === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    window.localStorage.setItem(LANDING_THEME_KEY, theme);
  }, [theme]);

  const openAuth = (mode: AuthMode) => {
    if (user) {
      void navigate({ to: "/workspace" });
      return;
    }
    setAuthMode(mode);
    setAuthOpen(true);
    setMobileNavOpen(false);
  };

  return (
    <div className={`landing-shell landing-theme-${theme} min-h-screen overflow-hidden`}>
      <SiteHeader
        user={Boolean(user)}
        theme={theme}
        onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        mobileNavOpen={mobileNavOpen}
        setMobileNavOpen={setMobileNavOpen}
        onOpenAuth={openAuth}
      />

      <main>
        <HeroSection onOpenAuth={() => openAuth("register")} />
        <PreviewSection onOpenAuth={() => openAuth("register")} />
        <MethodSection />
        <FaqSection />
        <FinalCta onOpenAuth={() => openAuth("register")} />
      </main>

      <SiteFooter />

      <Modal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        title="Akses workspace"
        description="Masuk atau buat akun untuk mulai menyusun BRD."
        size="md"
        className={`auth-dialog landing-auth-${theme} border-border bg-card p-0 text-card-foreground shadow-2xl`}
        bodyClassName="p-0"
      >
        <AuthPanel mode={authMode} onModeChange={setAuthMode} />
      </Modal>
    </div>
  );
}

function SiteHeader({
  user,
  theme,
  onToggleTheme,
  mobileNavOpen,
  setMobileNavOpen,
  onOpenAuth,
}: {
  user: boolean;
  theme: LandingTheme;
  onToggleTheme: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (value: boolean | ((previous: boolean) => boolean)) => void;
  onOpenAuth: (mode: AuthMode) => void;
}) {
  return (
    <header className="landing-header sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1320px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link to="/" aria-label={`${APP_NAME} home`} className="group flex items-center gap-3">
          <Logo showWordmark={false} markClassName="size-9" />
          <span className="landing-ink font-display text-[17px] font-bold tracking-[-0.035em]">
            halodocs<span className="landing-faint">.</span>
          </span>
        </Link>

        <nav aria-label="Navigasi utama" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="landing-nav-link text-[13px]">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          {user ? (
            <div className="flex items-center gap-4">
              <Link to="/workspace" className="landing-button landing-button-accent px-4 py-2 text-[12px]">
                Buka workspace <ArrowRight size={14} />
              </Link>
              <UserMenu />
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth("login")}
                className="landing-nav-link px-2 py-2 text-[13px]"
              >
                Masuk
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth("register")}
                className="landing-button landing-button-outline px-4 py-2 text-[12px]"
              >
                Mulai sekarang <ArrowRight size={14} />
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label={mobileNavOpen ? "Tutup menu" : "Buka menu"}
          onClick={() => setMobileNavOpen((previous) => !previous)}
          className="landing-icon-button lg:hidden"
        >
          {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileNavOpen && (
        <div className="landing-drawer border-t px-5 py-5 lg:hidden">
          <nav className="grid gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileNavOpen(false)}
                className="landing-drawer-link px-3 py-3 text-sm"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="landing-line mt-4 grid grid-cols-2 gap-2 border-t pt-4">
            {user ? (
              <Link
                to="/workspace"
                className="landing-button landing-button-accent col-span-2 justify-center py-2.5 text-xs"
              >
                Buka workspace <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onOpenAuth("login")}
                  className="landing-button landing-button-muted justify-center py-2.5 text-xs"
                >
                  Masuk
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth("register")}
                  className="landing-button landing-button-accent justify-center py-2.5 text-xs"
                >
                  Daftar
                </button>
              </>
            )}
          </div>
          <div className="mt-3 flex justify-end">
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          </div>
        </div>
      )}
    </header>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: LandingTheme; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      aria-label={dark ? "Gunakan mode terang" : "Gunakan mode gelap"}
      aria-pressed={dark}
      onClick={onToggle}
      className="landing-theme-toggle"
    >
      {dark ? <Sun size={14} /> : <Moon size={14} />}
      <span>{dark ? "Terang" : "Gelap"}</span>
    </button>
  );
}

function HeroSection({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <section className="landing-section relative border-b">
      <div className="relative mx-auto grid max-w-[1320px] items-end gap-14 px-5 pt-20 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-20 lg:px-10 lg:pt-28 lg:pb-28">
        <div className="max-w-[820px]">
          <p className="landing-mono landing-accent-text mb-7 text-[10px] uppercase tracking-[0.2em]">
            Mesin analis sistem / 01
          </p>
          <h1 className="landing-ink max-w-4xl font-display text-[clamp(3.2rem,7.4vw,7.2rem)] leading-[0.91] font-semibold tracking-[-0.075em]">
            Spesifikasi yang jelas,{" "}
            <span className="landing-accent-text">tanpa asumsi liar.</span>
          </h1>
          <div className="mt-9 flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <p className="landing-muted max-w-[470px] text-[15px] leading-7 sm:text-[16px]">
              Halodocs mengubah user story mentah dan dokumen lama menjadi BRD yang benar-benar bisa
              dieksekusi tim, dengan setiap asumsi terlihat sebelum menjadi kebutuhan resmi.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="landing-button landing-button-contrast group w-fit shrink-0 px-5 py-3 text-[13px]"
            >
              Susun BRD pertama Anda{" "}
              <ArrowDownRight
                size={15}
                className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:translate-y-0.5"
              />
            </button>
          </div>
        </div>

        <div className="relative hidden lg:block lg:pb-2">
          <p className="landing-mono landing-faint text-[10px] uppercase tracking-[0.18em]">
            Untuk tim yang peduli pada
          </p>
          <ul className="landing-divided landing-bordered-y mt-5">
            {[
              ["01", "Keputusan yang bisa dilacak"],
              ["02", "Detail siap produksi"],
              ["03", "Kendali penuh di tangan manusia"],
            ].map(([number, label]) => (
              <li key={number} className="landing-ink-soft flex items-center justify-between py-4 text-sm">
                <span>{label}</span>
                <span className="landing-mono landing-faint text-[10px]">{number}</span>
              </li>
            ))}
          </ul>
          <p className="landing-faint mt-5 max-w-[260px] text-[12px] leading-5">
            Dari pertanyaan pertama sampai persetujuan akhir, catatannya tetap pada orang yang memegang
            keputusan.
          </p>
        </div>
      </div>
    </section>
  );
}

function PreviewSection({ onOpenAuth }: { onOpenAuth: () => void }) {
  const [mode, setMode] = useState<PreviewMode>("clarify");

  return (
    <section id="preview" className="landing-section landing-section-alt border-b">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="landing-ink max-w-[620px] font-display text-3xl leading-[1.05] font-semibold tracking-[-0.05em] sm:text-5xl">
              Lihat kebutuhan menjadi keputusan.
            </h2>
            <p className="landing-muted mt-4 max-w-[520px] text-sm leading-6">
              Pratinjau nyata alur Halodocs: serap konteks, selesaikan ambiguitas, lalu setujui
              perubahannya.
            </p>
          </div>
          <span className="landing-mono landing-faint text-[10px] uppercase tracking-[0.16em]">
            Pratinjau sintetis / BRD-FIN-01
          </span>
        </div>

        <div className="landing-workbench overflow-hidden">
          <div className="landing-line flex flex-col border-b sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
              <span className="landing-status-dot size-2 rounded-full" />
              <span className="landing-mono landing-faint text-[10px] tracking-[0.08em]">
                HALODOCS / WORKSPACE / PEMBAYARAN
              </span>
            </div>
            <div className="landing-line flex overflow-x-auto border-t sm:border-t-0">
              {(
                [
                  ["draft", "01 / SERAP"],
                  ["clarify", "02 / KLARIFIKASI"],
                  ["review", "03 / REVIEW"],
                ] as const
              ).map(([item, label]) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={`landing-step-tab ${mode === item ? "landing-step-tab-active" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid min-h-[430px] lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="landing-line hidden border-r p-5 lg:block">
              <p className="landing-mono landing-faint text-[10px] uppercase tracking-[0.16em]">
                Indeks project
              </p>
              <div className="mt-7 space-y-1 text-[12px]">
                <div className="landing-nav-active rounded-md px-3 py-2.5">BRD / Transfer</div>
                <div className="landing-faint px-3 py-2.5">01. Konteks</div>
                <div className="landing-faint px-3 py-2.5">02. Kebutuhan</div>
                <div className="landing-faint px-3 py-2.5">03. Kriteria terima</div>
                <div className="landing-faint px-3 py-2.5">04. Jejak audit</div>
              </div>
              <div className="landing-line mt-16 border-t pt-4">
                <p className="landing-mono landing-faint text-[10px]">RUJUKAN</p>
                <p className="landing-muted mt-2 text-[11px] leading-5">2 dokumen sumber terindeks</p>
                <p className="landing-faint mt-1 text-[11px] leading-5">
                  Regulasi_BI_FAST_v2.pdf
                  <br />
                  SOP_Fallback_Switching.docx
                </p>
              </div>
            </aside>

            <div className="min-w-0 p-5 sm:p-8 lg:p-10">
              <PreviewContent mode={mode} onOpenAuth={onOpenAuth} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["2 putaran", "klarifikasi terarah"],
            ["ID BR / FR", "skema kebutuhan formal"],
            ["MD + PDF", "output siap serah"],
          ].map(([value, label]) => (
            <div key={value} className="landing-line border-t pt-3">
              <p className="landing-mono landing-accent-text text-[12px]">{value}</p>
              <p className="landing-faint mt-1 text-[12px]">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PreviewContent({ mode, onOpenAuth }: { mode: PreviewMode; onOpenAuth: () => void }) {
  if (mode === "draft") {
    return (
      <div className="animate-fade-in">
        <PreviewHeader label="User story masuk" status="BELUM DIPROSES" />
        <div className="mt-9 grid gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div>
            <p className="landing-mono landing-faint text-[10px]">USER_STORY_PROMPT.MD</p>
            <p className="landing-ink mt-4 max-w-[610px] text-[20px] leading-8 tracking-[-0.02em]">
              “Sebagai nasabah mobile banking, saya ingin melakukan transfer antarbank realtime via BI-FAST
              agar dana berpindah dalam waktu di bawah 5 detik.”
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Tag>sumber / user story</Tag>
              <Tag>prioritas / tinggi</Tag>
              <Tag>konteks / pembayaran</Tag>
            </div>
          </div>
          <div className="landing-line border-l pl-5">
            <p className="landing-mono landing-faint text-[10px]">AKSI BERIKUTNYA</p>
            <p className="landing-ink-soft mt-3 text-sm leading-6">
              Selesaikan yang belum jelas sebelum draf dokumen disusun.
            </p>
            <button type="button" onClick={onOpenAuth} className="landing-link-accent mt-6 text-[12px] font-semibold">
              Coba alur ini <ArrowRight size={13} className="ml-1 inline" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "review") {
    return (
      <div className="animate-fade-in">
        <PreviewHeader label="Usulan revisi" status="MENUNGGU PERSETUJUAN" />
        <div className="mt-8 max-w-[760px] space-y-2 font-mono text-[12px] leading-6">
          <div className="landing-diff-del px-4 py-3">
            <span className="landing-diff-sign-del mr-4 select-none">−</span>
            Timeout gateway disetel 30 detik tanpa jalur pemulihan.
          </div>
          <div className="landing-diff-add px-4 py-3">
            <span className="landing-diff-sign-add mr-4 select-none">+</span>
            Timeout gateway dibatasi 10 detik; transaksi yang belum selesai masuk antrean asinkron.
          </div>
          <div className="landing-diff-add px-4 py-3">
            <span className="landing-diff-sign-add mr-4 select-none">+</span>
            Simpan response code ISO-20022 ke jejak audit.
          </div>
        </div>
        <div className="landing-line mt-9 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <span className="landing-muted flex items-center gap-2 text-[12px]">
            <ShieldCheck size={15} className="landing-accent-text" />
            Tidak ada perubahan yang tersimpan tanpa persetujuan Anda.
          </span>
          <button
            type="button"
            onClick={onOpenAuth}
            className="landing-button landing-button-accent w-fit px-4 py-2.5 text-[12px]"
          >
            Buka workspace penuh <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PreviewHeader label="Klarifikasi putaran 1 dari 2" status="2 PERTANYAAN DITEMUKAN" />
      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <QuestionCard
          number="01"
          question="Apa yang terjadi bila gateway BI-FAST timeout setelah 10 detik?"
          options={["Masuk antrean pemulihan asinkron", "Gagalkan seketika dan kembalikan dana"]}
        />
        <QuestionCard
          number="02"
          question="Limit harian berlaku per rekening atau per CIF nasabah?"
          options={["Per CIF nasabah", "Per rekening debit"]}
        />
      </div>
      <div className="landing-line mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
        <span className="landing-muted text-[12px]">
          Jawaban ini mengunci arsitektur sebelum dokumen disusun.
        </span>
        <button
          type="button"
          onClick={onOpenAuth}
          className="landing-button landing-button-accent w-fit px-4 py-2.5 text-[12px]"
        >
          Lanjutkan di workspace <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

function PreviewHeader({ label, status }: { label: string; status: string }) {
  return (
    <div className="landing-line flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="landing-status-dot size-2 rounded-full" />
        <h3 className="landing-ink font-display text-[17px] font-semibold tracking-[-0.03em]">{label}</h3>
      </div>
      <span className="landing-chip-accent landing-mono w-fit px-2 py-1 text-[9px] tracking-[0.1em]">
        {status}
      </span>
    </div>
  );
}

function QuestionCard({
  number,
  question,
  options,
}: {
  number: string;
  question: string;
  options: string[];
}) {
  const [selected, setSelected] = useState(0);
  return (
    <div className="landing-question p-5">
      <div className="flex items-center justify-between">
        <span className="landing-mono landing-accent-text text-[10px]">PERTANYAAN {number}</span>
        <span className="landing-mono landing-faint text-[9px]">WAJIB</span>
      </div>
      <p className="landing-ink mt-4 max-w-[360px] text-[14px] leading-6">{question}</p>
      <div className="mt-5 grid gap-2">
        {options.map((option, index) => {
          const active = selected === index;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(index)}
              className={`landing-option ${active ? "landing-option-active" : ""}`}
            >
              <span className="landing-radio mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full">
                {active && <Check size={9} strokeWidth={3} />}
              </span>
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="landing-chip landing-mono px-2 py-1 text-[9px]">{children}</span>;
}

function MethodSection() {
  const items = [
    {
      icon: FileText,
      title: "Kunci konteksnya",
      body: "Bawa dokumen lama, template, dan user story. Basis pengetahuan project memberi setiap jawaban sumbernya.",
      meta: "PDF / DOCX / MD / OCR",
    },
    {
      icon: MessageSquareText,
      title: "Selesaikan yang penting",
      body: "Dua putaran klarifikasi terarah memunculkan edge case, SLA, dan jalur fallback sebelum draf disusun.",
      meta: "MAKS 2 PUTARAN",
    },
    {
      icon: GitCompareArrows,
      title: "Setujui perubahannya",
      body: "Tinjau setiap usulan klausul sebagai diff. Anda yang memutuskan apa yang menjadi versi berikutnya dan apa yang tetap utuh.",
      meta: "PERSETUJUAN EKSPLISIT",
    },
  ];
  return (
    <section id="method" className="landing-section border-b">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_2fr] lg:gap-24">
          <div>
            <h2 className="landing-ink max-w-[400px] font-display text-3xl leading-[1.05] font-semibold tracking-[-0.05em] sm:text-5xl">
              Jalur lebih pendek dari niat ke implementasi.
            </h2>
            <p className="landing-muted mt-5 max-w-[330px] text-sm leading-6">
              Sistem ini tegas di titik yang berisiko, dan tenang di bagian lainnya.
            </p>
          </div>
          <div className="landing-divided landing-bordered-y">
            {items.map(({ icon: Icon, title, body, meta }, index) => (
              <div key={title} className="group grid gap-5 py-7 sm:grid-cols-[42px_1fr_130px] sm:items-start">
                <div className="landing-icon-tile flex size-9 items-center justify-center">
                  <Icon size={16} />
                </div>
                <div>
                  <h3 className="landing-ink font-display text-[17px] font-semibold tracking-[-0.03em]">
                    {title}
                  </h3>
                  <p className="landing-muted mt-2 max-w-[500px] text-[13px] leading-6">{body}</p>
                </div>
                <span className="landing-mono landing-faint text-[9px] tracking-[0.11em] sm:pt-1">{meta}</span>
                <span className="landing-mono landing-faint hidden text-[10px] sm:block">0{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="landing-bordered-y mt-20 grid py-7 sm:grid-cols-3">
          <ProofStat value="2–5 menit" label="draf pertama tipikal" />
          <ProofStat value="BR-###" label="ID kebutuhan formal" />
          <ProofStat value="0" label="perubahan tersimpan tanpa persetujuan" />
        </div>
      </div>
    </section>
  );
}

function ProofStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="landing-line border-b py-3 last:border-0 sm:border-r sm:border-b-0 sm:px-7 sm:first:pl-0 sm:last:border-r-0">
      <p className="landing-accent-text font-display text-3xl font-semibold tracking-[-0.06em]">{value}</p>
      <p className="landing-faint mt-1 text-[12px]">{label}</p>
    </div>
  );
}

function FaqSection() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="landing-section landing-section-alt border-b">
      <div className="mx-auto grid max-w-[1000px] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.4fr] lg:gap-24 lg:py-28">
        <div>
          <h2 className="landing-ink font-display text-3xl leading-[1.05] font-semibold tracking-[-0.05em] sm:text-5xl">
            Jawaban singkatnya.
          </h2>
          <p className="landing-muted mt-5 text-sm leading-6">
            Beberapa hal yang biasanya ingin diketahui tim sebelum menyerahkan kebutuhan yang masih
            berantakan.
          </p>
        </div>
        <div className="landing-divided landing-bordered-y">
          {FAQS.slice(0, 5).map((faq, index) => {
            const isOpen = open === index;
            return (
              <div key={faq.question}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  className="landing-faq-trigger flex w-full items-center justify-between gap-6 py-5 text-left text-[13px] font-medium"
                >
                  <span>{faq.question}</span>
                  <ChevronDown
                    size={15}
                    className={`shrink-0 transition-transform duration-300 ${isOpen ? "landing-accent-text rotate-180" : "landing-faint"}`}
                  />
                </button>
                {isOpen && (
                  <p className="landing-muted animate-fade-in max-w-[600px] pr-8 pb-5 text-[12px] leading-6">
                    {faq.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <section className="relative overflow-hidden">
      <div className="landing-cta-glow absolute -top-32 -right-20 size-[420px] rounded-full" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[1320px] flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10 lg:py-28">
        <div>
          <p className="landing-mono landing-accent-text mb-5 text-[10px] uppercase tracking-[0.2em]">
            Serah terima yang berhasil
          </p>
          <h2 className="landing-ink max-w-[760px] font-display text-4xl leading-[.95] font-semibold tracking-[-0.065em] sm:text-6xl">
            Ubah “kebutuhan cepat” berikutnya menjadi dokumen yang bisa dipercaya tim.
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenAuth}
          className="landing-button landing-button-accent w-fit shrink-0 px-5 py-3 text-[13px]"
        >
          Mulai dengan Halodocs <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="landing-footer">
      <div className="mx-auto flex max-w-[1320px] flex-col gap-5 px-5 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <Logo showWordmark={false} markClassName="size-7" />
          <span className="landing-ink font-display text-sm font-bold tracking-[-0.03em]">
            halodocs<span className="landing-accent-text">.</span>
          </span>
          <span className="landing-mono landing-faint ml-2 text-[9px]">{APP_TAGLINE}</span>
        </div>
        <div className="landing-faint flex gap-5 text-[11px]">
          <a href="#preview" className="landing-link-accent">
            Pratinjau
          </a>
          <a href="#method" className="landing-link-accent">
            Metode
          </a>
          <a href="#faq" className="landing-link-accent">
            FAQ
          </a>
        </div>
        <p className="landing-mono landing-faint text-[9px]">
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
