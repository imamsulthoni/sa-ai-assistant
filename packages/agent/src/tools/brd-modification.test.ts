import { describe, expect, it } from "vitest";
import { applyChange, createModifyBrdTool, modifyBrdTool } from "./brd-modification.js";

const BRD = `# BRD

## 1. Kebutuhan fungsional
### FR-001
Sistem harus menerima pengajuan cuti.

### FR-002
Sistem harus menampilkan status pengajuan.
`;

describe("applyChange (free-text fallback)", () => {
  it("updates an existing id instead of duplicating it", () => {
    const result = applyChange(BRD, "ubah FR-001 agar maksimal 3 hari");
    expect(result.applied).toBe(1);
    expect(result.updatedMarkdown.match(/### FR-001/g)).toHaveLength(1);
    expect(result.updatedMarkdown).toContain("maksimal 3 hari");
  });

  it("removes a requirement by keyword", () => {
    const result = applyChange(BRD, "hapus FR-002");
    expect(result.updatedMarkdown).not.toContain("FR-002");
    expect(result.updatedMarkdown).toContain("FR-001");
  });

  it("adds a requirement when no id is present", () => {
    const result = applyChange(BRD, "tambahkan notifikasi email untuk approver");
    expect(result.affectedIds).toEqual(["FR-003"]);
    expect(result.updatedMarkdown).toContain("notifikasi email untuk approver");
  });
});

describe("modifyBrdTool", () => {
  it("applies structured operations as a pending preview", async () => {
    const output = await modifyBrdTool.call({
      brd: BRD,
      operations: [{ op: "update", requirementId: "FR-001", content: "Isi baru." }],
      changeRequest: "",
      referenceContext: "",
    });
    expect(output.applied).toBe(1);
    expect(output.persisted).toBe(false);
    expect(output.updatedMarkdown).toContain("Isi baru.");
    expect(output.userNotice).toContain("pratinjau");
  });

  it("returns null markdown and reports gaps when nothing applies", async () => {
    const output = await modifyBrdTool.call({
      brd: BRD,
      operations: [{ op: "remove", requirementId: "BR-999" }],
      changeRequest: "",
      referenceContext: "",
    });
    expect(output.applied).toBe(0);
    expect(output.updatedMarkdown).toBeNull();
    expect(output.gaps[0]).toContain("BR-999");
  });
});

describe("createModifyBrdTool", () => {
  it("resolves the active BRD server-side and stages the preview without returning markdown", async () => {
    const staged: Array<{ updatedMarkdown: string; changeSummary: string }> = [];
    const tool = createModifyBrdTool({
      getActiveBrd: () => ({ contentMarkdown: BRD, versions: [] }),
      stageBrdModification: (input) => {
        staged.push(input);
        return { ok: true };
      },
    });

    const output = await tool.call({
      operations: [
        {
          op: "update_section",
          sectionTitle: "Kebutuhan fungsional",
          content: "Bagian fungsional yang diperkaya.",
        },
      ],
      changeRequest: "",
      referenceContext: "",
    });

    expect(output.applied).toBe(1);
    expect(output.staged).toBe(true);
    expect(output.stagingReason).toBeNull();
    expect((output as { updatedMarkdown?: unknown }).updatedMarkdown).toBeUndefined();
    expect(staged).toHaveLength(1);
    expect(staged[0]?.updatedMarkdown).toContain("Bagian fungsional yang diperkaya.");
    expect(output.userNotice).toContain("pratinjau");
  });

  it("reports pending_exists without exposing markdown", async () => {
    const tool = createModifyBrdTool({
      getActiveBrd: () => ({ contentMarkdown: BRD, versions: [] }),
      stageBrdModification: () => ({ ok: false, reason: "pending_exists" }),
    });

    const output = await tool.call({
      operations: [{ op: "update", requirementId: "FR-001", content: "Isi baru." }],
      changeRequest: "",
      referenceContext: "",
    });

    expect(output.staged).toBe(false);
    expect(output.stagingReason).toBe("pending_exists");
    expect(output.userNotice).toContain("belum disetujui");
  });

  it("reports the modification as unstaged when no staging adapter is configured", async () => {
    const tool = createModifyBrdTool({
      getActiveBrd: () => ({ contentMarkdown: BRD, versions: [] }),
    });

    const output = await tool.call({
      operations: [{ op: "update", requirementId: "FR-001", content: "Isi baru." }],
      changeRequest: "",
      referenceContext: "",
    });

    expect(output.applied).toBe(1);
    expect(output.staged).toBe(false);
    expect(output.userNotice).toContain("tidak distage");
  });

  it("reports a gap when there is no active BRD to resolve", async () => {
    const tool = createModifyBrdTool({ getActiveBrd: () => null });

    const output = await tool.call({
      operations: [],
      changeRequest: "perdalam section apapun",
      referenceContext: "",
    });

    expect(output.applied).toBe(0);
    expect(output.gaps[0]).toContain("BRD aktif");
    expect(output.stagingReason).toBe("not_found");
  });
});
