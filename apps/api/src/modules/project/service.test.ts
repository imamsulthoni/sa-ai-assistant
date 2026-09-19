import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  document: { findFirst: vi.fn() },
}));

const documentMock = vi.hoisted(() => ({
  deleteDocument: vi.fn(),
  deleteDocumentVectors: vi.fn(),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../document/services.js", () => ({
  deleteDocument: documentMock.deleteDocument,
  deleteDocumentVectors: documentMock.deleteDocumentVectors,
}));

import {
  DEFAULT_PROJECT_NAME,
  deleteProject,
  ensureDefaultProject,
  listProjects,
} from "./service.js";

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-1",
    name: "Pengajuan Cuti",
    description: null,
    templateId: null,
    isDefault: false,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-02T00:00:00.000Z"),
    _count: { sessions: 3, documents: 2 },
    brds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listProjects", () => {
  it("maps counts and the project BRD summary", async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([
      projectRow({
        brds: [
          {
            id: "brd-1",
            title: "BRD Cuti",
            currentVersion: 2,
            status: "IN_REVIEW",
            pendingContentMarkdown: "preview",
          },
        ],
      }),
    ]);

    const projects = await listProjects("user-1");

    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      id: "p-1",
      sessionCount: 3,
      documentCount: 2,
      brd: {
        id: "brd-1",
        currentVersion: 2,
        status: "IN_REVIEW",
        hasPendingModification: true,
      },
    });
  });

  it("reports a null BRD when the project has none", async () => {
    prismaMock.project.findMany.mockResolvedValueOnce([projectRow()]);

    const [project] = await listProjects("user-1");

    expect(project.brd).toBeNull();
    expect(project.isDefault).toBe(false);
  });
});

describe("deleteProject", () => {
  it("cleans vectors and R2 objects before deleting the row", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce({
      id: "p-1",
      documents: [{ id: "doc-1", objectKey: "key-1" }],
    });
    documentMock.deleteDocument.mockResolvedValue(undefined);
    documentMock.deleteDocumentVectors.mockResolvedValue(undefined);
    prismaMock.project.delete.mockResolvedValue({});

    await expect(deleteProject("user-1", "p-1")).resolves.toBe(true);

    expect(documentMock.deleteDocumentVectors).toHaveBeenCalledWith("doc-1");
    expect(documentMock.deleteDocument).toHaveBeenCalledWith("key-1");
    expect(prismaMock.project.delete).toHaveBeenCalledWith({ where: { id: "p-1" } });
  });

  it("returns false without side effects when the project is not owned", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null);

    await expect(deleteProject("user-1", "p-x")).resolves.toBe(false);

    expect(prismaMock.project.delete).not.toHaveBeenCalled();
    expect(documentMock.deleteDocument).not.toHaveBeenCalled();
  });
});

describe("ensureDefaultProject", () => {
  it("reuses the existing Inbox project", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(
      projectRow({ isDefault: true, name: DEFAULT_PROJECT_NAME }),
    );

    const project = await ensureDefaultProject("user-1");

    expect(project.id).toBe("p-1");
    expect(prismaMock.project.create).not.toHaveBeenCalled();
  });

  it("creates the Inbox project when none exists", async () => {
    prismaMock.project.findFirst.mockResolvedValueOnce(null);
    prismaMock.project.create.mockResolvedValueOnce(
      projectRow({ isDefault: true, name: DEFAULT_PROJECT_NAME }),
    );

    const project = await ensureDefaultProject("user-1");

    expect(project.name).toBe(DEFAULT_PROJECT_NAME);
    expect(prismaMock.project.create).toHaveBeenCalledWith({
      data: { userId: "user-1", name: DEFAULT_PROJECT_NAME, isDefault: true },
      include: expect.anything(),
    });
  });
});