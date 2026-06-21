// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import { NodeInspector } from "./NodeInspector";

const actEnvironment = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("NodeInspector", () => {
  let mountedRoot: Root | null = null;
  let mountedContainer: HTMLDivElement | null = null;

  afterEach(() => {
    if (mountedRoot) {
      act(() => {
        mountedRoot?.unmount();
      });
    }
    mountedContainer?.remove();
    mountedRoot = null;
    mountedContainer = null;
    document.body.innerHTML = "";
  });

  it("keeps persistent object settings out of the inspect surface", () => {
    const html = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(NodeInspector, props()))
    );

    expect(html).toContain("aria-label=\"Object Settings\"");
    expect(html).toContain("Float");
    expect(html).not.toContain("Send name");
    expect(html).not.toContain("Receive name");
  });

  it("opens persistent object settings in a dialog", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(createElement(MantineProvider, null, createElement(NodeInspector, props())));
    });

    await clickButton(container, "Object Settings");

    expect(document.body.textContent).toContain("Object Settings");
    expect(document.body.textContent).toContain("Send name");
    expect(document.body.textContent).toContain("Receive name");
  });
});

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label) || candidate.getAttribute("aria-label") === label
  );
  if (!button) {
    throw new Error(`button not found: ${label}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function props(): Parameters<typeof NodeInspector>[0] {
  return {
    graphLocked: false,
    node: node(),
    onImportAsset: async () => undefined,
    onRemoveNode: () => undefined,
    onSendRuntimeControl: () => undefined,
    onSetNodeParam: () => undefined,
    onSyncShaderInputs: () => undefined,
    runtimeAssetImportBusy: false,
    runtimeAssetImportEnabled: false,
    runtimeControlBusy: false,
    runtimeControlEnabled: false
  };
}

function node(): GraphNodeV01 {
  return {
    id: "float_1",
    kind: "core.float",
    kindVersion: "0.1.0",
    params: {
      label: "Float",
      receiveName: "",
      sendName: "speed",
      value: 0.5,
      widget: "number"
    },
    ports: [
      {
        id: "in",
        direction: "input",
        type: {
          dataKind: "number.float",
          flow: "value"
        }
      },
      {
        id: "value",
        direction: "output",
        type: {
          dataKind: "number.float",
          flow: "value"
        }
      }
    ]
  };
}
