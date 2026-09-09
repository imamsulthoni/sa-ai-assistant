import type { DocumentFileType } from "../../generated/prisma/enums.js";

export function documentFileType(file: File): DocumentFileType {
  if (file.type === "application/pdf") return "PDF";
  if (file.type === "text/markdown" || file.name.toLowerCase().endsWith(".md")) {
    return "MARKDOWN";
  }
  if (file.type.includes("wordprocessingml.document") || file.name.toLowerCase().endsWith(".docx")) {
    return "DOCX";
  }
  if (file.type.startsWith("image/")) return "IMAGE_FLOWCHART";
  return "OTHER";
}
