import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionSidebar } from "./session-sidebar.js";

const baseProps = {
  sessions: [],
  activeId: null,
  loading: false,
  onNew: () => undefined,
  onOpen: () => undefined,
  onRename: () => undefined,
  onDelete: () => undefined,
  onOpenSettings: () => undefined,
};

describe("SessionSidebar", () => {
  it("locks the new-session action until the project has a BRD", () => {
    const html = renderToStaticMarkup(
      createElement(SessionSidebar, {
        ...baseProps,
        newDisabled: true,
        newDisabledHint: "Tunggu BRD selesai dulu.",
      }),
    );

    expect(html).toContain('disabled=""');
    expect(html).toContain("Tunggu BRD selesai dulu.");
  });

  it("enables the new-session action once a BRD exists", () => {
    const html = renderToStaticMarkup(createElement(SessionSidebar, baseProps));

    expect(html).not.toContain('disabled=""');
  });
});