/**
 * Utilitas untuk merapikan message agent yang sudah tersimpan di memory Prisma.
 * Message lama bisa memuat payload besar (mis. seluruh BRD dari tool
 * get_active_brd) sehingga ikut ter-replay di setiap turn. Helper ini memotong
 * payload tersebut tanpa merusak bentuk Message yang valid.
 */

export const STORED_MESSAGE_MAX_CHARS = 20000;

const TRUNCATION_NOTE =
  "\n… (isi lama dipotong untuk menghemat konteks; panggil ulang tool bila butuh detail)";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function storedMessageChars(message: unknown): number {
  try {
    return JSON.stringify(message)?.length ?? 0;
  } catch {
    return 0;
  }
}

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const bodyLimit = limit > TRUNCATION_NOTE.length ? limit - TRUNCATION_NOTE.length : limit;
  return `${value.slice(0, bodyLimit)}${TRUNCATION_NOTE}`;
}

function truncateJson(value: unknown, limit: number): unknown {
  let serialized: string;
  try {
    serialized = JSON.stringify(value) ?? "";
  } catch {
    return value;
  }
  if (serialized.length <= limit) return value;
  return {
    truncated: true,
    originalChars: serialized.length,
    preview: serialized.slice(0, Math.max(0, limit - 120)),
  };
}

function trimContentPart(part: unknown, limit: number): unknown {
  if (!isRecord(part)) return part;
  if (part.type === "text" && typeof part.text === "string") {
    return { ...part, text: truncateText(part.text, limit) };
  }
  if (
    part.type === "file" &&
    isRecord(part.data) &&
    part.data.type === "text" &&
    typeof part.data.text === "string"
  ) {
    return { ...part, data: { ...part.data, text: truncateText(part.data.text, limit) } };
  }
  return part;
}

function trimToolOutput(output: unknown, limit: number): unknown {
  if (!isRecord(output)) return output;
  if (
    (output.type === "text" || output.type === "error-text") &&
    typeof output.value === "string"
  ) {
    return { ...output, value: truncateText(output.value, limit) };
  }
  if (output.type === "json" || output.type === "error-json") {
    return { ...output, value: truncateJson(output.value, limit) };
  }
  if (output.type === "content" && Array.isArray(output.value)) {
    return { ...output, value: output.value.map((part) => trimContentPart(part, limit)) };
  }
  return output;
}

function trimPart(part: unknown, role: unknown, limit: number): unknown {
  if (!isRecord(part)) return part;
  if (part.type === "tool-result") {
    return { ...part, output: trimToolOutput(part.output, limit) };
  }
  if (part.type === "tool-call") {
    return { ...part, input: truncateJson(part.input, limit) };
  }
  if ((part.type === "text" || part.type === "reasoning") && typeof part.text === "string") {
    return { ...part, text: truncateText(part.text, limit) };
  }
  if (role === "user") return trimContentPart(part, limit);
  return part;
}

function trimParts(message: Record<string, unknown>, maxChars: number): Record<string, unknown> {
  const content = message.content;
  if (!Array.isArray(content) || content.length === 0) return message;
  const budget = Math.max(1000, Math.floor(maxChars / content.length));
  return {
    ...message,
    content: content.map((part) => trimPart(part, message.role, budget)),
  };
}

/** Potong payload besar pada satu message memory tanpa mengubah role/tipenya. */
export function trimStoredMessage(
  message: unknown,
  maxChars: number = STORED_MESSAGE_MAX_CHARS,
): unknown {
  if (!isRecord(message)) return message;
  if (storedMessageChars(message) <= maxChars) return message;
  const role = message.role;
  if (role === "system" && typeof message.content === "string") {
    return { ...message, content: truncateText(message.content, maxChars) };
  }
  if (role === "user" && typeof message.content === "string") {
    return { ...message, content: truncateText(message.content, maxChars) };
  }
  return trimParts(message, maxChars);
}
