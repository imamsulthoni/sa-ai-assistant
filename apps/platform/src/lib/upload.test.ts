import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_UPLOAD_BYTES,
  ATTACHMENT_MAX_UPLOAD_LABEL,
  BRD_IMPORT_MAX_UPLOAD_BYTES,
  BRD_IMPORT_MAX_UPLOAD_LABEL,
} from "./upload.js";

describe("upload limits", () => {
  it("caps session attachments at 10MB", () => {
    expect(ATTACHMENT_MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
    expect(ATTACHMENT_MAX_UPLOAD_LABEL).toBe("10 MB");
  });

  it("caps BRD import at 20MB", () => {
    expect(BRD_IMPORT_MAX_UPLOAD_BYTES).toBe(20 * 1024 * 1024);
    expect(BRD_IMPORT_MAX_UPLOAD_LABEL).toBe("20 MB");
  });
});
