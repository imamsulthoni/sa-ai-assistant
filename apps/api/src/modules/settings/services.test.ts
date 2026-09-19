import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  document: { findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  userSetting: { findUnique: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
}));

const documentMock = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  deleteDocumentVectors: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../document/services.js", () => ({
  deleteDocument: documentMock.deleteDocument,
  deleteDocumentVectors: documentMock.deleteDocumentVectors,
  documentUrl: () => "",
  uploadDocument: vi.fn(),
}));
vi.mock("../../lib/queue.js", () => ({
  documentQueue: { add: vi.fn() },
  templateQueue: { add: vi.fn() },
  retryPolicies: { ingestion: {}, template: {} },
}));
vi.mock("../../lib/crypto.js", () => ({
  encryptSecret: (value: string) => value,
  decryptSecret: (value: string) => value,
}));

import { deleteTemplate, listTemplates } from "./services.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listTemplates", () => {
  it("maps every template and marks the active one", async () => {
    prismaMock.document.findMany.mockResolvedValueOnce([
      {
        id: "tpl-1",
        title: "Template A",
        status: "READY",
        templateStructure: { sections: [{ id: "a" }, { id: "b" }] },
        error: null,
        updatedAt: new Date("2026-09-19T00:00:00.000Z"),
      },
      {
        id: "tpl-2",
        title: "Template B",
        status: "PROCESSING",
        templateStructure: null,
        error: null,
        updatedAt: new Date("2026-09-18T00:00:00.000Z"),
      },
    ]);
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: "tpl-1" });

    const result = await listTemplates("user-1");

    expect(result.activeTemplateId).toBe("tpl-1");
    expect(result.templates).toHaveLength(2);
    expect(result.templates[0]).toMatchObject({
      id: "tpl-1",
      hasStructure: true,
      sectionCount: 2,
    });
    expect(result.templates[1]).toMatchObject({
      id: "tpl-2",
      hasStructure: false,
      sectionCount: 0,
    });
  });
});

describe("deleteTemplate", () => {
  it("deletes a template and clears the active pointer when needed", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce({
      id: "tpl-1",
      objectKey: "key-1",
    });
    documentMock.deleteDocumentVectors.mockResolvedValue(undefined);
    documentMock.deleteDocument.mockResolvedValue(undefined);
    prismaMock.userSetting.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.document.delete.mockResolvedValue({});

    await expect(deleteTemplate("user-1", "tpl-1")).resolves.toBe(true);

    expect(documentMock.deleteDocumentVectors).toHaveBeenCalledWith("tpl-1");
    expect(documentMock.deleteDocument).toHaveBeenCalledWith("key-1");
    expect(prismaMock.userSetting.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", activeTemplateId: "tpl-1" },
      data: { activeTemplateId: null },
    });
    expect(prismaMock.document.delete).toHaveBeenCalledWith({ where: { id: "tpl-1" } });
  });

  it("does nothing when the template is not owned by the user", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null);

    await expect(deleteTemplate("user-1", "tpl-x")).resolves.toBe(false);

    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(documentMock.deleteDocument).not.toHaveBeenCalled();
  });
});