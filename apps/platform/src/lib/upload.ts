import { formatBytes } from "#/lib/copy";

/** Samakan dengan default MAX_UPLOAD_BYTES di API (50MB). */
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export function resolveMaxUploadBytes(raw: string | number | undefined): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_UPLOAD_BYTES;
}

export const MAX_UPLOAD_BYTES = resolveMaxUploadBytes(import.meta.env.VITE_MAX_UPLOAD_BYTES);
export const MAX_UPLOAD_LABEL = formatBytes(MAX_UPLOAD_BYTES);
