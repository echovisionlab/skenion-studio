// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NodeCatalogEntryV01 } from "@skenion/contracts";
import { theme } from "../theme";
import { PalettePanel } from "./PalettePanel";

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

describe("PalettePanel", () => {
  it("renders direct node tools from the Runtime catalog and submits their object spec", () => {
    const onAddObjectSpec = vi.fn();
    renderPalette({ catalogEntries: [catalogEntry(), catalogEntry({ objectId: "operator.mul", primaryObjectSpec: "*~", title: "Audio Multiply" })], onAddObjectSpec });

    expect(container?.textContent).toContain("1 available tools");
    expect(container?.textContent).toContain("Float");
    expect(container?.textContent).toContain("f");
    expect(container?.textContent).not.toContain("Audio Multiply");
    expect(container?.textContent).not.toContain("*~");

    clickButton("Float");

    expect(onAddObjectSpec).toHaveBeenCalledWith("f");
  });

  it("does not invent catalog entries when Runtime has not provided a catalog", () => {
    renderPalette({ catalogEntries: [], onAddObjectSpec: vi.fn() });

    expect(container?.textContent).toContain("Runtime catalog unavailable");
    expect(container?.textContent).not.toContain("Float");
    expect(container?.textContent).toContain("Object");
  });

  it("creates an empty Object without sending an object spec", () => {
    const onAddObject = vi.fn();
    const onAddObjectSpec = vi.fn();
    renderPalette({ catalogEntries: [], onAddObject, onAddObjectSpec });

    clickButton("Object");

    expect(onAddObject).toHaveBeenCalledWith();
    expect(onAddObjectSpec).not.toHaveBeenCalled();
  });
});

function renderPalette(props: {
  catalogEntries: NodeCatalogEntryV01[];
  onAddObject?: () => void;
  onAddObjectSpec: (objectSpec: string) => void;
}) {
  act(() => {
    root?.render(
      createElement(
        MantineProvider,
        { theme },
        createElement(PalettePanel, {
          catalogEntries: props.catalogEntries,
          onAddObject: props.onAddObject ?? vi.fn(),
          onAddObjectSpec: props.onAddObjectSpec
        })
      )
    );
  });
}

function clickButton(label: string) {
  const button = Array.from(container?.querySelectorAll("button") ?? []).find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!button) {
    throw new Error(`Missing button ${label}`);
  }
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function catalogEntry(options: Partial<{
  objectId: string;
  primaryObjectSpec: string;
  title: string;
}> = {}): NodeCatalogEntryV01 {
  const objectId = options.objectId ?? "float";
  const title = options.title ?? "Float";
  const primaryObjectSpec = options.primaryObjectSpec ?? "f";
  return {
    catalogId: `core:${objectId}`,
    objectId,
    primaryObjectSpec,
    provider: { kind: "core" },
    definition: {
      schema: "skenion.node.definition",
      schemaVersion: "0.1.0",
      id: `core.${objectId}`,
      version: "0.1.0",
      displayName: title,
      category: "Values",
      ports: [
        {
          id: "value",
          direction: "output",
          type: "value.core.float32",
          label: "Value",
          rate: "control"
        }
      ],
      execution: { model: "event" },
      state: { persistent: true },
      permissions: [],
      capabilities: []
    },
    creatable: true,
    display: {
      title,
      category: "Values",
      palette: "direct"
    }
  };
}
