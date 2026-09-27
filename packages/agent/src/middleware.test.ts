import { describe, expect, it } from "vitest";
import { createToolOutputCapMiddleware } from "./middleware.js";

function toolOutputArgs(toolName: string, result: string) {
  return {
    toolName,
    args: "{}",
    result,
    originalResult: result,
    turn: 1,
    internalCallId: "call-1",
  };
}

describe("createToolOutputCapMiddleware", () => {
  it("leaves small tool outputs untouched", () => {
    const middleware = createToolOutputCapMiddleware();
    expect(
      middleware.onToolOutput?.(toolOutputArgs("search_context", "hasil pendek")),
    ).toBeUndefined();
  });

  it("truncates outputs above the default limit", () => {
    const middleware = createToolOutputCapMiddleware({ maxChars: 100 });
    const replacement = middleware.onToolOutput?.(
      toolOutputArgs("search_context", "x".repeat(500)),
    ) as { result: string } | undefined;
    expect(replacement?.result.length).toBeLessThanOrEqual(100);
    expect(replacement?.result).toContain("dipotong");
  });

  it("applies a tighter per-tool limit", () => {
    const middleware = createToolOutputCapMiddleware({
      perToolMaxChars: { get_active_brd: 120 },
    });
    const replacement = middleware.onToolOutput?.(
      toolOutputArgs("get_active_brd", "y".repeat(400)),
    ) as { result: string } | undefined;
    expect(replacement?.result.length).toBeLessThanOrEqual(120);
    expect(
      middleware.onToolOutput?.(toolOutputArgs("other_tool", "y".repeat(400))),
    ).toBeUndefined();
  });
});
