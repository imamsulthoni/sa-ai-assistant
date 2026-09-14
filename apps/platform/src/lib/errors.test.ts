import { describe, expect, it } from "vitest";
import { describeError } from "./errors.js";

describe("describeError", () => {
  it("prefers the server-provided detail message", () => {
    const error = new Error("Request to /brd/x failed (409)", {
      cause: { error: "Konflik data." },
    });
    expect(describeError(error)).toBe("Konflik data.");
  });

  it("maps status codes to Indonesian copy", () => {
    expect(describeError(new Error("Request to /documents failed (413)"))).toMatch(/ukuran/i);
    expect(describeError(new Error("Request to /documents failed (415)"))).toMatch(
      /tidak didukung/i,
    );
    expect(describeError(new Error("Request to /chat failed (503)"))).toMatch(/sibuk/i);
  });

  it("falls back to the original message when unknown", () => {
    expect(describeError(new Error("Network down"))).toBe("Network down");
    expect(describeError("boom")).toBe("boom");
  });
});
