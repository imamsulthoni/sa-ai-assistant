import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { Badge } from "#/components/base/badge";
import { Button } from "#/components/base/button";
import { MarkdownContent } from "#/components/markdown/markdown-content";

export const Route = createFileRoute("/mermaid-demo")({ component: MermaidDemoPage });

const SAMPLES: Array<{ title: string; note: string; chart: string }> = [
  {
    title: "Flowchart (format prompt BRD)",
    note: "Format yang diminta agent generate: flowchart TD dengan percabangan.",
    chart: `flowchart TD
  A[Mulai] --> B[Isi Pengajuan]
  B --> C{Validasi}
  C -->|Tidak Valid| B
  C -->|Valid| D[Menunggu Persetujuan]
  D --> E{Supervisor}
  E -->|Setujui| F[Diproses]
  E -->|Tolak| G[Dikembalikan]
  G --> B`,
  },
  {
    title: "Graph TD",
    note: "Sintaks lama yang tetap didukung.",
    chart: `graph TD
  A-->B
  A-->C
  B-->D
  C-->D`,
  },
  {
    title: "Sequence Diagram",
    note: "Bukan flowchart, untuk memastikan diagram lain ikut ter-render.",
    chart: `sequenceDiagram
  participant U as User
  participant S as Sistem
  U->>S: Ajukan cuti
  S-->>U: Status pengajuan
  S->>S: Validasi kuota`,
  },
  {
    title: "State Diagram",
    note: "Contoh status lifecycle dokumen.",
    chart: `stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> IN_REVIEW: Ajukan
  IN_REVIEW --> APPROVED: Setujui
  IN_REVIEW --> DRAFT: Kembalikan
  APPROVED --> [*]`,
  },
  {
    title: "Class Diagram",
    note: "Uji label dengan tipe dan method.",
    chart: `classDiagram
  class BrdDocument {
    +string id
    +int currentVersion
    +approve()
  }
  class BrdVersion {
    +int version
    +string contentMarkdown
  }
  BrdDocument "1" --> "*" BrdVersion`,
  },
  {
    title: "ER Diagram",
    note: "Uji relasi antar entitas.",
    chart: `erDiagram
  SESSION ||--o{ BRD : memiliki
  BRD ||--o{ BRD_VERSION : menyimpan`,
  },
  {
    title: "Pie Chart",
    note: "Uji diagram non-graf.",
    chart: `pie title Distribusi Prioritas
  "MUST" : 60
  "SHOULD" : 30
  "MAY" : 10`,
  },
  {
    title: "Gantt Chart",
    note: "Uji diagram dengan tanggal dan task.",
    chart: `gantt
  title Timeline Rilis
  dateFormat YYYY-MM-DD
  section Fase 1
  Analisis :a1, 2026-01-01, 10d
  Desain :a2, after a1, 7d
  section Fase 2
  Implementasi :b1, after a2, 14d`,
  },
];

const DEFAULT_CUSTOM = `flowchart LR
  Start([Mulai]) --> Check{Apakah data lengkap?}
  Check -- Ya --> Save[Simpan]
  Check -- Tidak --> Fix[Perbaiki Data]
  Fix --> Check
  Save --> End([Selesai])`;

function MermaidDemoPage() {
  const [custom, setCustom] = useState(DEFAULT_CUSTOM);
  const customSource = useMemo(
    () => `## Diagram Custom\n\n\`\`\`mermaid\n${custom.trim()}\n\`\`\`\n`,
    [custom],
  );

  return (
    <div className="min-h-screen bg-slate-100/60 pb-16 dark:bg-slate-950">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
              <FlaskConical size={15} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                Demo Render Mermaid
              </h1>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                Halaman uji render MarkdownContent — jalur yang sama dengan panel BRD.
              </p>
            </div>
            <Badge tone="info">/mermaid-demo</Badge>
          </div>
          <Link to="/workspace">
            <Button variant="outline" size="sm">
              <ArrowLeft size={12} /> Workspace
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-4xl space-y-5 px-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
            Uji Diagram Custom
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Tempel kode mermaid (tanpa fence) untuk melihat hasil render persis seperti di BRD.
          </p>
          <textarea
            rows={8}
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            spellCheck={false}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-900 focus:ring-1 focus:ring-slate-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            {custom.trim() ? (
              <MarkdownContent source={customSource} />
            ) : (
              <p className="text-[11px] text-slate-400">Tulis kode mermaid untuk merender.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xs font-semibold tracking-wider text-slate-900 uppercase dark:text-slate-100">
            Contoh Per Jenis Diagram
          </h2>
          {SAMPLES.map((sample) => (
            <SampleCard key={sample.title} {...sample} />
          ))}
        </section>
      </main>
    </div>
  );
}

function SampleCard({ title, note, chart }: { title: string; note: string; chart: string }) {
  const source = `\`\`\`mermaid\n${chart}\n\`\`\`\n`;
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950/50">
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{note}</p>
        </div>
        <details className="text-[11px] text-slate-500 dark:text-slate-400">
          <summary className="cursor-pointer select-none">Lihat kode</summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-[11px] dark:border-slate-800 dark:bg-slate-950">
            {chart}
          </pre>
        </details>
      </div>
      <div className="p-4">
        <MarkdownContent source={source} />
      </div>
    </article>
  );
}
