import { describe, expect, it } from "vitest";
import { documentFileType } from "./types.js";

function makeFile(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("documentFileType", () => {
  it("maps known MIME types", () => {
    expect(documentFileType(makeFile("a.pdf", "application/pdf"))).toBe("PDF");
    expect(documentFileType(makeFile("a.md", "text/markdown"))).toBe("MARKDOWN");
    expect(
      documentFileType(
        makeFile(
          "a.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
      ),
    ).toBe("DOCX");
    expect(documentFileType(makeFile("a.png", "image/png"))).toBe("IMAGE_FLOWCHART");
  });

  it("falls back to the file extension when the MIME type is missing", () => {
    expect(documentFileType(makeFile("a.md", ""))).toBe("MARKDOWN");
    expect(documentFileType(makeFile("a.docx", ""))).toBe("DOCX");
  });

  it("classifies everything else as OTHER", () => {
    expect(documentFileType(makeFile("a.txt", "text/plain"))).toBe("OTHER");
  });
});
