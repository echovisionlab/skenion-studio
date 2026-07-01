// @vitest-environment happy-dom
import { createElement, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import { FloatingPanel, clampFloatingPanelPosition, clampFloatingPanelSize } from "./FloatingPanel";

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

describe("FloatingPanel", () => {
  it("renders a non-modal panel with a close action", () => {
    const onActivate = vi.fn();
    const onClose = vi.fn();

    render(
      createElement(
        FloatingPanel,
        {
          onActivate,
          onClose,
          onMove: vi.fn(),
          position: { height: 240, width: 320, x: 12, y: 20, zIndex: 42 },
          title: "Logs"
        },
        "Runtime logs"
      )
    );

    expect(document.body.querySelector("section")?.getAttribute("aria-label")).toBe("Logs");
    expect(document.body.querySelector("section")?.getAttribute("style")).toContain("left: 12px");
    expect(document.body.querySelector("section")?.getAttribute("style")).toContain("top: 20px");
    expect(document.body.textContent).toContain("Runtime logs");

    act(() => {
      document.body.querySelector('button[aria-label="Close Logs"]')?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the moved panel inside the viewport bounds", () => {
    expect(
      clampFloatingPanelPosition(
        { x: -100, y: -100 },
        { height: 300, width: 400 },
        { height: 600, width: 800 }
      )
    ).toEqual({ x: 4, y: 4 });

    expect(
      clampFloatingPanelPosition(
        { x: 780, y: 900 },
        { height: 300, width: 400 },
        { height: 600, width: 800 }
      )
    ).toEqual({ x: 396, y: 566 });
  });

  it("keeps resized panels within the viewport bounds", () => {
    expect(
      clampFloatingPanelSize(
        { height: 80, width: 120 },
        { x: 10, y: 10 },
        { height: 600, width: 800 }
      )
    ).toEqual({ height: 180, width: 220 });

    expect(
      clampFloatingPanelSize(
        { height: 900, width: 900 },
        { x: 500, y: 420 },
        { height: 600, width: 800 }
      )
    ).toEqual({ height: 180, width: 296 });
  });
});

function render(node: ReactNode) {
  act(() => {
    root?.render(createElement(MantineProvider, { theme }, node));
  });
}
