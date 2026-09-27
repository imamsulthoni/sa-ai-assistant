import type { ReactNode } from "react";
import { StreamMarkdown } from "@anvia/react-ui";
import { cn } from "#/lib/utils";
import { MermaidDiagram } from "#/components/markdown/mermaid-diagram";

type HastNode = {
  value?: string;
  tagName?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
};

type MarkdownComponentProps = {
  children?: ReactNode;
  node?: HastNode;
  className?: string;
  href?: string;
  src?: string;
  alt?: string;
  type?: string;
  checked?: boolean;
};

type MarkdownComponents = Record<string, (props: MarkdownComponentProps) => ReactNode>;

function hastText(node: HastNode | undefined): string {
  if (!node) return "";
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(hastText).join("");
}

function classNameOf(node: HastNode | undefined): string {
  const className = node?.properties?.className;
  if (Array.isArray(className)) return className.join(" ");
  return typeof className === "string" ? className : "";
}

function MarkdownPre({ node, children }: MarkdownComponentProps) {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  if (classNameOf(codeNode).includes("language-mermaid")) {
    const chart = hastText(codeNode).trim();
    if (chart) return <MermaidDiagram chart={chart} />;
  }
  return (
    <pre className="my-3 overflow-x-auto rounded-md border border-border bg-muted p-3 text-xs text-foreground">
      {children}
    </pre>
  );
}

/** Komponen markdown bergaya mockup (slate). */
export function createMarkdownComponents(): MarkdownComponents {
  return {
    h1: ({ children }) => (
      <h1 className="mt-5 mb-2.5 border-b border-border pb-1.5 text-xl font-bold tracking-tight text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-4 mb-1.5 text-base font-bold text-foreground">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-3 mb-1 text-xs font-bold tracking-wider text-foreground uppercase">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mt-2 mb-1 text-xs font-semibold text-muted-foreground">
        {children}
      </h4>
    ),
    p: ({ children }) => (
      <p className="my-1 text-xs leading-relaxed text-muted-foreground">{children}</p>
    ),
    a: ({ children, href }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-primary underline underline-offset-2 hover:text-primary/90"
      >
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-1 ml-4 list-disc space-y-0.5 text-xs text-muted-foreground">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="my-1 ml-4 list-decimal space-y-0.5 text-xs text-muted-foreground">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-2 border-border pl-3 text-xs text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-4 border-t border-border" />,
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    code: ({ children, className }) => {
      const fenced = typeof className === "string" && className.startsWith("language-");
      if (fenced) {
        return (
          <code className={cn("font-mono text-xs whitespace-pre", className)}>{children}</code>
        );
      }
      return (
        <code className="rounded border border-border bg-muted px-1 py-px font-mono text-[11px] text-foreground">
          {children}
        </code>
      );
    },
    pre: MarkdownPre,
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-md border border-border shadow-2xs">
        <table className="min-w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-muted">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
        {children}
      </th>
    ),
    tr: ({ children }) => (
      <tr className="border-t border-border even:bg-muted">
        {children}
      </tr>
    ),
    td: ({ children }) => (
      <td className="px-3 py-2 align-top text-muted-foreground">{children}</td>
    ),
    input: ({ type, checked }) => {
      if (type !== "checkbox") return null;
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="mr-1 size-3.5 rounded border-input align-middle accent-primary"
        />
      );
    },
    img: ({ src, alt }) => (
      <img
        src={typeof src === "string" ? src : undefined}
        alt={alt ?? ""}
        className="my-3 max-w-full rounded-md border border-border"
      />
    ),
  };
}

export const markdownComponents: MarkdownComponents = createMarkdownComponents();

export function MarkdownContent({ source, className }: { source: string; className?: string }) {
  return (
    <StreamMarkdown
      content={source}
      components={markdownComponents}
      className={cn("font-sans text-xs", className)}
    />
  );
}
