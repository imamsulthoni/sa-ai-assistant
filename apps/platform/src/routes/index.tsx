import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  AtSign,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  History,
  Sparkles,
  Upload,
} from "lucide-react";
import { SettingsDialog } from "#/components/settings/settings-page";

export const Route = createFileRoute("/")({ component: Landing });

const FEATURES = [
  {
    icon: Upload,
    title: "Template adoption",
    body: "Upload your company's BRD standard once — the assistant extracts its structure and applies it to every draft after your approval.",
  },
  {
    icon: Sparkles,
    title: "Proactive clarification",
    body: "No silent assumptions. Ambiguities are surfaced as focused questions (max 2 rounds) before the draft is generated.",
  },
  {
    icon: FileText,
    title: "Structured BRD generation",
    body: "A User Story becomes a complete BRD draft — including FR/NFR, assumptions, and traceability — streamed live.",
  },
  {
    icon: History,
    title: "Version control",
    body: "Every snapshot is saved as a version. Review diffs between versions and restore/rollback at any time.",
  },
  {
    icon: Download,
    title: "Export MD & PDF",
    body: "Ship the final document to your Git repo or knowledge base as Markdown, or download a formatted PDF.",
  },
  {
    icon: AtSign,
    title: "Cross-session @mention",
    body: "Type @ to find BRDs from other sessions and copy them into the current workspace as a new baseline.",
  },
];

const STEPS = [
  ["Open the workspace", "Create a new chat session from the sidebar."],
  [
    "Paste the user story",
    "Use the dedicated New BRD panel; attach a reference document if you have one.",
  ],
  [
    "Answer clarifications",
    "Pick an option or write a custom answer — max 2 rounds, or generate directly.",
  ],
  ["Review & edit", "Fine-tune the draft in the split markdown editor and save versions."],
  [
    "Export & share",
    "Download Markdown/PDF, or reference the BRD from other sessions via @mention.",
  ],
];

function Landing() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Bot size={18} />
            </span>
            System Analyst AI Assistant
          </div>
          <div className="flex items-center gap-2">
            <SettingsDialog />
            <Link
              to="/workspace"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open workspace <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Before-coding intelligence for System Analysts
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          From user story to verified BRD, in minutes.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          The System Analyst AI Assistant drafts company-standard BRDs, asks the right clarifying
          questions, keeps a full version history, and verifies flowcharts against the document — so
          you can focus on architecture, not paperwork.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/workspace"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <FileText size={16} /> Start a new BRD
          </Link>
          <a
            href="#how"
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-semibold hover:bg-accent"
          >
            How it works <ArrowRight size={16} />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-semibold">What it does</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-2xl border bg-card p-5">
              <div className="mb-3 grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                <Icon size={18} />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-semibold">Cara pakai</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="flex gap-4 rounded-xl border bg-card p-4">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 size={15} className="text-emerald-600" />
          AI model &amp; credentials are provided server-side — nothing to configure.
        </p>
      </section>

      <footer className="mx-auto max-w-5xl px-5 py-10 text-center text-xs text-muted-foreground">
        System Analyst AI Assistant — turn requirements into verified specifications.
      </footer>
    </main>
  );
}
