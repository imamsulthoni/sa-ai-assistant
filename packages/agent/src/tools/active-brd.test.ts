import { describe, expect, it } from "vitest";
import { createActiveBrdTool } from "./active-brd.js";
import { findBrdSection, parseBrdSections, renderBrdOutline } from "./brd-outline.js";

const BRD = `# BRD — Platform Kursus

## 1. Versi dan Approvals
Versi 1, status Draft.

## 5. Business Requirement
### 5.1 Gambaran Umum
Ringkasan kebutuhan bisnis platform.
### BR-001
Pendaftaran akun multi-kanal.
### BR-002
Transparansi kualitas kursus.

## 6. Spesifikasi Program
### FR-001
Sistem harus menampilkan katalog kursus.
### FR-002
Sistem harus memproses pembayaran.
`;

const VERSIONS = [
  {
    id: "v-1",
    versionNumber: 1,
    changeSummary: "Draf awal",
    createdBy: "AI_AGENT",
    createdAt: "2026-09-19T00:00:00.000Z",
  },
];

describe("brd-outline helpers", () => {
  it("keeps nested content inside the parent section body", () => {
    const sections = parseBrdSections(BRD);
    const business = sections.find((section) => section.title.startsWith("5. Business"));
    expect(business?.requirementIds).toEqual(["BR-001", "BR-002"]);
    expect(business?.chars).toBeGreaterThan(50);
  });

  it("finds the shallowest matching section", () => {
    const match = findBrdSection(BRD, "business requirement");
    expect(match?.node.title).toBe("5. Business Requirement");
    expect(match?.content).toContain("BR-002");
  });

  it("renders version metadata and requirement ids", () => {
    const outline = renderBrdOutline(BRD, VERSIONS);
    expect(outline).toContain("versions: 1");
    expect(outline).toContain("BR-001, BR-002");
    expect(outline).toContain("FR-001, FR-002");
  });
});

describe("get_active_brd tool", () => {
  const adapters = {
    getActiveBrd: () => ({ contentMarkdown: BRD, versions: VERSIONS }),
  };

  it("returns a compact outline by default", async () => {
    const tool = createActiveBrdTool(adapters);
    const output = await tool.call({});
    expect(output.found).toBe(true);
    expect(output.mode).toBe("outline");
    expect(output.contentMarkdown).toBeNull();
    expect(output.outline).toContain("BR-001");
    expect(output.versions).toHaveLength(1);
  });

  it("returns one section subtree in section mode", async () => {
    const tool = createActiveBrdTool(adapters);
    const output = await tool.call({ mode: "section", section: "Business Requirement" });
    expect(output.mode).toBe("section");
    expect(output.section?.title).toBe("5. Business Requirement");
    expect(output.section?.content).toContain("BR-002");
    expect(output.contentMarkdown).toBeNull();
  });

  it("asks for a section reference when section mode has none", async () => {
    const tool = createActiveBrdTool(adapters);
    const output = await tool.call({ mode: "section" });
    expect(output.section).toBeNull();
    expect(output.gaps?.[0]).toContain("section");
  });

  it("returns the full markdown in full mode", async () => {
    const tool = createActiveBrdTool(adapters);
    const output = await tool.call({ mode: "full" });
    expect(output.mode).toBe("full");
    expect(output.contentMarkdown).toContain("# BRD — Platform Kursus");
  });

  it("refuses full mode when allowFull is false and falls back to the outline", async () => {
    const tool = createActiveBrdTool(adapters, { allowFull: false });
    const output = await tool.call({ mode: "full" });
    expect(output.mode).toBe("outline");
    expect(output.contentMarkdown).toBeNull();
    expect(output.outline).toContain("BR-001");
    expect(output.gaps?.[0]).toContain("mode=full");
  });

  it("reports a missing BRD", async () => {
    const tool = createActiveBrdTool({ getActiveBrd: () => null });
    const output = await tool.call({});
    expect(output.found).toBe(false);
    expect(output.gaps?.[0]).toContain("BRD aktif");
  });
});
