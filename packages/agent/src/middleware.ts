import { createMiddleware } from "@anvia/core";

/** Batas default output tool supaya hasil besar tidak membanjiri konteks model. */
export const DEFAULT_TOOL_OUTPUT_MAX_CHARS = 16000;

/**
 * Batas khusus per tool. `get_active_brd` dijaga ketat karena seluruh konten BRD
 * bisa ikut masuk konteks (dan memory sesi) lewat tool ini.
 */
export const TOOL_OUTPUT_MAX_CHARS: Record<string, number> = {
  get_active_brd: 10000,
  web_search: 6000,
  get_template_structure: 32000,
};

export type ToolOutputCapOptions = {
  maxChars?: number;
  perToolMaxChars?: Record<string, number>;
};

function cappedOutput(toolName: string, result: string, limit: number): string {
  const note = `\n\n[output ${toolName} dipotong otomatis pada ${limit} karakter. Minta bagian yang lebih spesifik bila butuh detail.]`;
  if (note.length >= limit) return note.slice(0, limit);
  return `${result.slice(0, limit - note.length)}${note}`;
}

/**
 * Middleware output tool: memotong hasil yang melebihi batas sebelum dikirim ke
 * model. Karena middleware berjalan sebelum message tool disimpan, memory sesi
 * juga tidak ikut menyimpan payload besar (mis. BRD penuh).
 */
export function createToolOutputCapMiddleware(options: ToolOutputCapOptions = {}) {
  const defaultLimit = options.maxChars ?? DEFAULT_TOOL_OUTPUT_MAX_CHARS;
  const perTool = { ...TOOL_OUTPUT_MAX_CHARS, ...options.perToolMaxChars };
  return createMiddleware({
    onToolOutput: ({ toolName, result }) => {
      const limit = perTool[toolName] ?? defaultLimit;
      if (result.length <= limit) return;
      return { result: cappedOutput(toolName, result, limit) };
    },
  });
}
