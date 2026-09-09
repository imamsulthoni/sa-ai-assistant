import z from "zod";

export const UploadDocumentSchema = z.object({
  file: z.instanceof(File),
});

export const MAX_DOCUMENT_SIZE = Number(
  process.env.MAX_UPLOAD_BYTES ?? 50 * 1024 * 1024,
);

export const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
]);
