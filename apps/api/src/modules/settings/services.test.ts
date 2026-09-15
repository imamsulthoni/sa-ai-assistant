import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  document: { findFirst: vi.fn() },
  userSetting: { findUnique: vi.fn() },
}));

vi.mock("../../lib/prisma.js", () => ({ prisma: prismaMock }));

import { getCurrentTemplate } from "./services.js";

const inFlightTemplate = {
  id: "t-in-flight",
  title: "standar-brd.pdf",
  status: "PROCESSING",
  templateStructure: null,
  error: null,
};

const activeTemplate = {
  id: "t-active",
  title: "standar-lama.pdf",
  status: "READY",
  templateStructure: { sections: [] },
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentTemplate", () => {
  it("lets an in-flight template beat the active one", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(inFlightTemplate);

    await expect(getCurrentTemplate("user-1")).resolves.toEqual(inFlightTemplate);
    expect(prismaMock.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          isTemplate: true,
          status: { in: ["UPLOADING", "PROCESSING", "PENDING_CONFIRMATION"] },
        }),
        orderBy: { updatedAt: "desc" },
      }),
    );
    expect(prismaMock.userSetting.findUnique).not.toHaveBeenCalled();
  });

  it("falls back to the active template when nothing is in flight", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(activeTemplate);
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: "t-active" });

    await expect(getCurrentTemplate("user-1")).resolves.toEqual(activeTemplate);
    expect(prismaMock.document.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { id: "t-active", userId: "user-1", isTemplate: true } }),
    );
  });

  it("returns null when there is neither an in-flight nor an active template", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null);
    prismaMock.userSetting.findUnique.mockResolvedValueOnce(null);

    await expect(getCurrentTemplate("user-1")).resolves.toBeNull();
  });

  it("does not query documents when the user has no active template", async () => {
    prismaMock.document.findFirst.mockResolvedValueOnce(null);
    prismaMock.userSetting.findUnique.mockResolvedValueOnce({ activeTemplateId: null });

    await expect(getCurrentTemplate("user-1")).resolves.toBeNull();
    expect(prismaMock.document.findFirst).toHaveBeenCalledTimes(1);
  });
});
