import type { ReactNode } from "react";
import MarkdownPreview from "@uiw/react-markdown-preview";
import { MermaidDiagram } from "#/components/markdown/mermaid-diagram";

type PreProps = React.ComponentProps<"pre"> & { node?: unknown };

function nodeText(value: ReactNode): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(nodeText).join("");
  return "";
}

function MarkdownPre({ children, node: _node, ...props }: PreProps) {
  const child = Array.isArray(children) ? children[0] : children;
  const childProps = (child as { props?: { className?: string; children?: ReactNode } } | null)
    ?.props;
  const className = childProps?.className ?? "";
  if (typeof className === "string" && className.includes("language-mermaid")) {
    const chart = nodeText(childProps?.children);
    if (chart.trim()) return <MermaidDiagram chart={chart} />;
  }
  return <pre {...props}>{children}</pre>;
}

export function MarkdownContent({
  source,
  className,
  colorMode = "light",
}: {
  source: string;
  className?: string;
  colorMode?: "light" | "dark";
}) {
  return (
    <MarkdownPreview
      source={source}
      className={className}
      wrapperElement={{ "data-color-mode": colorMode }}
      components={{ pre: MarkdownPre }}
    />
  );
}
