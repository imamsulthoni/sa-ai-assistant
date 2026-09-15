import { beforeEach, describe, expect, it, vi } from "vitest";

// The module under test pulls in the memory store, which validates the client shape.
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  agentMemorySession: { upsert: vi.fn(), deleteMany: vi.fn() },
  agentMemoryMessage: { findMany: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  brdDocument: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { rejectBrdModification, stageBrdModification } from "./services.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("stageBrdModification", () => {
  it("puts a draft under review and remembers the previous status", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "DRAFT",
      statusBeforePending: null,
      pendingContentMarkdown: null,
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await expect(
      stageBrdModification("user-1", "brd-1", "konten baru", "ringkasan"),
    ).resolves.toEqual({
      ok: true,
      status: "staged",
    });
    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith({
      where: { id: "brd-1" },
      data: {
        pendingContentMarkdown: "konten baru",
        pendingChangeSummary: "ringkasan",
        statusBeforePending: "DRAFT",
        status: "IN_REVIEW",
      },
    });
  });

  it("keeps the original restore point when an approved document is modified again", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "APPROVED",
      statusBeforePending: "DRAFT",
      pendingContentMarkdown: null,
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await stageBrdModification("user-1", "brd-1", "konten baru", "ringkasan");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statusBeforePending: "DRAFT", status: "IN_REVIEW" }),
      }),
    );
  });

  it("never overwrites an unresolved pending preview", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: "DRAFT",
      pendingContentMarkdown: "preview lama",
    });

    const result = await stageBrdModification("user-1", "brd-1", "preview baru", "ringkasan");

    expect(result).toMatchObject({ ok: false, reason: "pending_exists" });
    expect(prismaMock.brdDocument.update).not.toHaveBeenCalled();
  });
});

describe("rejectBrdModification", () => {
  it("restores the status the document had before the preview", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: "APPROVED",
      pendingContentMarkdown: "preview",
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await rejectBrdModification("user-1", "brd-1");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith({
      where: { id: "brd-1" },
      data: {
        pendingContentMarkdown: null,
        pendingChangeSummary: null,
        status: "APPROVED",
        statusBeforePending: null,
      },
    });
  });

  it("keeps the current status when there is no restore point", async () => {
    prismaMock.brdDocument.findFirst.mockResolvedValueOnce({
      id: "brd-1",
      userId: "user-1",
      status: "IN_REVIEW",
      statusBeforePending: null,
      pendingContentMarkdown: "preview",
    });
    prismaMock.brdDocument.update.mockResolvedValueOnce({});

    await rejectBrdModification("user-1", "brd-1");

    expect(prismaMock.brdDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "IN_REVIEW", statusBeforePending: null }),
      }),
    );
  });
});
