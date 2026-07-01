// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../theme";
import { PanelRail, WorkspaceSideDock } from "./PanelRail";

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

describe("PanelRail", () => {
  it("renders an empty rail without placeholder actions", () => {
    render(
      <PanelRail edge="left" items={[]} />
    );

    expect(container?.querySelector("nav")?.getAttribute("aria-label")).toBe("left panel actions");
    expect(container?.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders tooltip-backed icon actions", () => {
    const onClick = vi.fn();
    render(
      <PanelRail
        edge="right"
        items={[{ icon: "N", id: "nodes", label: "Nodes", onClick, selected: true }]}
      />
    );

    const button = container?.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Nodes");
    expect(button?.getAttribute("data-selected")).toBe("true");
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps side dock rail visible when content is closed", () => {
    render(
      <WorkspaceSideDock
        contentOpen={false}
        edge="left"
        railItems={[{ icon: "N", id: "nodes", label: "Nodes" }]}
      >
        Hidden content
      </WorkspaceSideDock>
    );

    expect(container?.textContent).not.toContain("Hidden content");
    expect(container?.querySelectorAll("button")).toHaveLength(1);
  });
});

function render(node: React.ReactNode) {
  act(() => {
    root?.render(<MantineProvider theme={theme}>{node}</MantineProvider>);
  });
}
