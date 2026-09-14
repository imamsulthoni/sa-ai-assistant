import { describe, expect, it } from "vitest";
import { applyChange, modifyBrdTool } from "./brd-modification.js";

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
