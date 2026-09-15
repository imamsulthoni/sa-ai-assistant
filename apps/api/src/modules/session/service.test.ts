import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  agentMemorySession: { findMany: vi.fn() },
  brdDocument: { findMany: vi.fn() },
  brdFlowState: { findMany: vi.fn() },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { listSessions } from "./service.js";

function sessionRow(sessionId: string, updatedAt: string, messages = 3) {
  return {
    sessionId,
    title: `Sesi ${sessionId}`,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date(updatedAt),
    _count: { messages },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listSessions", () => {
  it("attaches the latest BRD, pending modification flag, and flow phase per session", async () => {
    prismaMock.agentMemorySession.findMany.mockResolvedValueOnce([
      sessionRow("s-with-brd", "2026-09-02T00:00:00.000Z"),
      sessionRow("s-clarifying", "2026-09-03T00:00:00.000Z"),
      sessionRow("s-empty", "2026-09-04T00:00:00.000Z", 0),
    ]);
    prismaMock.brdDocument.findMany
      .mockResolvedValueOnce([
        { id: "brd-new", sessionId: "s-with-brd", currentVersion: 3, status: "IN_REVIEW" },
        { id: "brd-old", sessionId: "s-with-brd", currentVersion: 1, status: "DRAFT" },
      ])
      .mockResolvedValueOnce([{ sessionId: "s-with-brd" }]);
    prismaMock.brdFlowState.findMany.mockResolvedValueOnce([
      { sessionId: "s-clarifying", phase: "CLARIFYING", round: 2 },
      { sessionId: "s-empty", phase: null, round: 1 },
    ]);

    const sessions = await listSessions("user-1");

    expect(sessions).toHaveLength(3);
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
