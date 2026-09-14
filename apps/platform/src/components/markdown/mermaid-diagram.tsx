import { useEffect, useId, useState } from "react";
import { cn } from "#/lib/utils";

let mermaidPromise: Promise<typeof import("mermaid").default> | undefined;

function loadMermaid() {
  mermaidPromise ??= import("mermaid").then((module) => module.default);
  return mermaidPromise;
}

/**
 * Renders a mermaid code block into SVG. The library is loaded lazily so pages
 * without diagrams never pay for the chunk.
 */
export function MermaidDiagram({ chart, className }: { chart: string; className?: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setDark(root.classList.contains("dark"));
    const observer = new MutationObserver(() => setDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSvg(null);
    setError(null);
    void loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: dark ? "dark" : "default",
        });
        const id = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${dark ? "d" : "l"}`;
        const result = await mermaid.render(id, chart);
        if (!cancelled) setSvg(result.svg);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Gagal merender diagram.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [chart, dark, reactId]);

  if (error) {
    return (
      <div
        className={cn(
          "my-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs",
          className,
        )}
      >
        <p className="font-medium text-destructive">Diagram tidak dapat dirender</p>
        <pre className="mt-2 overflow-auto font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          "my-3 flex h-24 items-center justify-center rounded-xl border bg-muted/30 text-xs text-muted-foreground",
          className,
        )}
      >
        Memuat diagram…
      </div>
    );
  }

  return (
    <div
      className={cn("my-3 overflow-auto rounded-xl border bg-card p-3", className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
