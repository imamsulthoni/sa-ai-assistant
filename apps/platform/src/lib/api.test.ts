import { describe, expect, it } from "vitest";
import { filenameFromDisposition } from "./api.js";

describe("filenameFromDisposition", () => {
  it("falls back when the header is missing", () => {
    expect(filenameFromDisposition(null, "brd.pdf")).toBe("brd.pdf");
  });

  it("reads a plain filename parameter", () => {
    expect(filenameFromDisposition('attachment; filename="BRD-Cuti.pdf"', "brd.pdf")).toBe(
      "BRD-Cuti.pdf",
    );
  });

  it("prefers the RFC 5987 UTF-8 filename", () => {
    expect(
      filenameFromDisposition(
        "attachment; filename=\"brd.pdf\"; filename*=UTF-8''BRD%20Cuti%20Tahunan.pdf",
        "brd.pdf",
      ),
    ).toBe("BRD Cuti Tahunan.pdf");
  });

  it("falls back to the plain filename when UTF-8 decoding fails", () => {
    expect(
      filenameFromDisposition("attachment; filename=brd.pdf; filename*=UTF-8''%E0%A4%A", "x.pdf"),
    ).toBe("brd.pdf");
  });
});
