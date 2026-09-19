import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  userSetting: { findUnique: vi.fn() },
  document: { findFirst: vi.fn() },
  agentMemorySession: { findFirst: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
  agentMemoryMessage: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  brdDocument: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { activeTemplateFor } from "./services.js";

const structure = {
  sections: [{ id: "scope", title: "Ruang Lingkup", required: true, order: 0 }],
  idConventions: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("activeTemplateFor", () => {
  it("prefers a valid project template over the user's active template", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({ templateId: "project-tpl" });
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: "user-tpl" });
    prismaMock.document.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        templateStructure: structure,
        updatedAt: new Date("2026-09-19T00:00:00.000Z"),
      }),
    );

    const result = await activeTemplateFor("user-1", "project-1");

    expect(result?.templateId).toBe("project-tpl");
  });

  it("falls back to the active template when the project template no longer exists", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({ templateId: "deleted-tpl" });
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: "user-tpl" });
    prismaMock.document.findFirst.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        where.id === "user-tpl"
          ? {
              id: "user-tpl",
              templateStructure: structure,
              updatedAt: new Date("2026-09-19T00:00:00.000Z"),
            }
          : null,
    );

    const result = await activeTemplateFor("user-1", "project-1");

    expect(result?.templateId).toBe("user-tpl");
  });

  it("returns null when neither candidate is usable", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({ templateId: "deleted-tpl" });
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: null });
    prismaMock.document.findFirst.mockResolvedValue(null);

    await expect(activeTemplateFor("user-1", "project-1")).resolves.toBeNull();
  });
});