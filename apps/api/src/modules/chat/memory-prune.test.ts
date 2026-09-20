import { describe, expect, it } from "vitest";
import { storedMessageChars, trimStoredMessage } from "./memory-prune.js";

type ToolOutput = { type: string; value: unknown };

function toolMessage(value: string) {
  return {
    role: "tool",
    content: [
      {
        type: "tool-result",
        toolCallId: "call-1",
        toolName: "get_active_brd",
        output: { type: "text", value },
      },
    ],
  };
}

describe("storedMessageChars", () => {
  it("measures the serialized message size", () => {
    expect(storedMessageChars({ role: "user", content: "halo" })).toBeGreaterThan(0);
    expect(storedMessageChars(undefined)).toBe(0);
  });
});

describe("trimStoredMessage", () => {
  it("leaves messages below the limit untouched", () => {
    const message = toolMessage("pendek");
    expect(trimStoredMessage(message, 1000)).toBe(message);
  });

  it("truncates oversized tool text output", () => {
    const message = toolMessage("x".repeat(5000));
    const trimmed = trimStoredMessage(message, 1000) as ReturnType<typeof toolMessage>;
    const output = trimmed.content[0].output as ToolOutput;
    expect(String(output.value).length).toBeLessThanOrEqual(1000);
    expect(String(output.value)).toContain("dipotong");
    expect(storedMessageChars(trimmed)).toBeLessThan(storedMessageChars(message));
  });

  it("keeps truncated json output valid", () => {
    const message = {
      role: "tool",
      content: [
        {
          type: "tool-result",
          toolCallId: "call-2",
          toolName: "search_context",
          output: { type: "json", value: { big: "z".repeat(5000) } },
        },
      ],
    };
    const trimmed = trimStoredMessage(message, 1000) as typeof message;
    expect(trimmed.content[0].output.value).toMatchObject({ truncated: true });
  });

  it("truncates oversized user content", () => {
    const message = { role: "user", content: "y".repeat(5000) };
    const trimmed = trimStoredMessage(message, 800) as { content: string };
    expect(trimmed.content.length).toBeLessThanOrEqual(800);
    expect(trimmed.content).toContain("dipotong");
  });
});
