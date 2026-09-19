import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  agentMemorySession: { findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  agentMemoryMessage: { deleteMany: vi.fn() },
  brdDocument: { findMany: vi.fn(), deleteMany: vi.fn() },
  brdFlowState: { findMany: vi.fn(), deleteMany: vi.fn() },
  document: { findMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(async (operations: unknown[]) => Promise.all(operations)),
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { deleteSession, listSessions } from "./service.js";

function sessionRow(sessionId: string, updatedAt: string, projectId: string, messages = 3) {
  return {
    sessionId,
    title: `Sesi ${sessionId}`,
    projectId,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date(updatedAt),
    _count: { messages },
    project: { id: projectId, name: `Project ${projectId}` },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSessions", () => {
  it("attaches the project BRD, pending modification flag, and flow phase per session", async () => {
    prismaMock.agentMemorySession.findMany.mockResolvedValueOnce([
      sessionRow("s-with-brd", "2026-09-02T00:00:00.000Z", "p-brd"),
      sessionRow("s-clarifying", "2026-09-03T00:00:00.000Z", "p-clar"),
      sessionRow("s-empty", "2026-09-04T00:00:00.000Z", "p-empty", 0),
    ]);
    prismaMock.brdDocument.findMany.mockResolvedValueOnce([
      {
        id: "brd-new",
        projectId: "p-brd",
        currentVersion: 3,
        status: "IN_REVIEW",
        pendingContentMarkdown: "preview",
      },
    ]);
    prismaMock.brdFlowState.findMany.mockResolvedValueOnce([
      { projectId: "p-clar", phase: "CLARIFYING", round: 2 },
      { projectId: "p-empty", phase: null, round: 1 },
    ]);

    const sessions = await listSessions("user-1");

    expect(sessions).toHaveLength(3);
    expect(sessions[0].projectId).toBe("p-brd");
    expect(sessions[0].projectName).toBe("Project p-brd");
    expect(sessions[0].brd).toEqual({
      id: "brd-new",
      currentVersion: 3,
      status: "IN_REVIEW",
      hasPendingModification: true,
    });
    expect(sessions[0].flow).toBeNull();
    expect(sessions[1].brd).toBeNull();
    expect(sessions[1].flow).toEqual({ phase: "CLARIFYING", round: 2 });
    expect(sessions[2].brd).toBeNull();
    expect(sessions[2].flow).toBeNull();
    expect(sessions[2].messageCount).toBe(0);
  });

  it("skips status queries when there are no sessions", async () => {
    prismaMock.agentMemorySession.findMany.mockResolvedValueOnce([]);

    await expect(listSessions("user-1")).resolves.toEqual([]);
    expect(prismaMock.brdDocument.findMany).not.toHaveBeenCalled();
    expect(prismaMock.brdFlowState.findMany).not.toHaveBeenCalled();
  });
});

describe("deleteSession", () => {
  it("only removes the conversation memory, not the project knowledge base", async () => {
    prismaMock.agentMemorySession.findFirst.mockResolvedValueOnce({ id: "memory-1" });
    prismaMock.agentMemoryMessage.deleteMany.mockResolvedValue({ count: 4 });
    prismaMock.agentMemorySession.delete.mockResolvedValue({});

    await expect(deleteSession("user-1", "s-1")).resolves.toBe(true);

    expect(prismaMock.agentMemorySession.delete).toHaveBeenCalledWith({
      where: { id: "memory-1" },
    });
    expect(prismaMock.document.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.brdDocument.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.brdFlowState.deleteMany).not.toHaveBeenCalled();
  });

  it("returns false for a session that does not belong to the user", async () => {
    prismaMock.agentMemorySession.findFirst.mockResolvedValueOnce(null);

    await expect(deleteSession("user-1", "s-x")).resolves.toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});