import { describe, expect, it } from "vitest";
import { escapeMermaidQuotes } from "./mermaid-diagram";

describe("escapeMermaidQuotes", () => {
  it("mengganti kutip ganda mentah dengan entitas mermaid", () => {
    expect(escapeMermaidQuotes('A[Klik "Terapkan"]')).toBe("A[Klik #quot;Terapkan#quot;]");
  });

  it("tidak mengubah chart yang tidak memuat kutip", () => {
    expect(escapeMermaidQuotes("flowchart TD\n  A --> B")).toBe("flowchart TD\n  A --> B");
  });

  it("menangani beberapa kutip sekaligus", () => {
    expect(escapeMermaidQuotes('A["x"] --> B["y"]')).toBe("A[#quot;x#quot;] --> B[#quot;y#quot;]");
  });
});