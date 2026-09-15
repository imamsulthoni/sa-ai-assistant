import { describe, expect, it } from "vitest";
import {
  EMPTY_STORY_FIELDS,
  composeUserStory,
  parseUserStory,
  type BrdStoryFields,
} from "./story-input.js";

const FULL: BrdStoryFields = {
  featureName: "Open Finance Aggregation",
  userStory: "Sebagai nasabah, saya ingin menghubungkan rekening bank lain.",
  businessObjective: "Konsolidasi saldo multi-bank.",
  targetUsers: "Nasabah ritel",
  acceptanceCriteria: "Linking < 45 detik",
  technicalConstraints: "Standar SNAP BI",
};

describe("composeUserStory", () => {
  it("labels every provided field", () => {
    const text = composeUserStory(FULL);
    expect(text).toContain("Nama Fitur / Inisiatif: Open Finance Aggregation");
    expect(text).toContain("User Story Utama: Sebagai nasabah");
    expect(text).toContain("Batasan Teknis / Regulasi: Standar SNAP BI");
  });

  it("skips empty optional fields", () => {
    const text = composeUserStory({
      ...EMPTY_STORY_FIELDS,
      featureName: "Fitur A",
      userStory: "Cerita",
    });
    expect(text.split("\n")).toHaveLength(2);
  });
});

describe("parseUserStory", () => {
  it("round-trips a composed payload", () => {
    expect(parseUserStory(composeUserStory(FULL))).toEqual(FULL);
  });

  it("treats unknown text as a plain user story", () => {
    expect(parseUserStory("Sebagai admin saya ingin export data")).toEqual({
      ...EMPTY_STORY_FIELDS,
      userStory: "Sebagai admin saya ingin export data",
    });
  });

  it("keeps unstructured leftovers inside the user story", () => {
    const parsed = parseUserStory("Nama Fitur / Inisiatif: X\ncatatan tambahan");
    expect(parsed.featureName).toBe("X");
    expect(parsed.userStory).toBe("catatan tambahan");
  });

  it("returns empty fields for blank input", () => {
    expect(parseUserStory("   ")).toEqual(EMPTY_STORY_FIELDS);
  });
});
