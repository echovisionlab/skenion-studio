import { SegmentedControl, Tooltip } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { sampleGraph } from "../data/sampleGraph";
import { validateGraph } from "../graph/skenionGraph";
import { StudioToolbar } from "./StudioToolbar";

describe("StudioToolbar", () => {
  it("switches between editor and performance modes", () => {
    const modes: unknown[] = [];
    const element = toolbar({
      mode: "editor",
      onModeChange: (mode) => modes.push(mode)
    });
    const segmented = findElementsByType(element, SegmentedControl)[0];

    segmented?.props.onChange?.("performance");

    expect(modes).toEqual(["performance"]);
  });

  it("hides editor-only graph actions in performance mode", () => {
    const element = toolbar({ mode: "performance" });
    const labels = findElementsByType(element, Tooltip).map((tooltip) => tooltip.props.label);

    expect(labels).toContain("Open project (.skenion.json)");
    expect(labels).not.toContain("Save project (.skenion.json)");
    expect(labels).not.toContain("Import graph JSON");
    expect(labels).not.toContain("Export graph JSON");
    expect(labels).not.toContain("Load send/receive panel sample");
  });
});

function toolbar(
  props: Partial<Parameters<typeof StudioToolbar>[0]>
) {
  return StudioToolbar({
    graph: sampleGraph,
    mode: "editor",
    summary: "8 nodes",
    validation: validateGraph(sampleGraph),
    onExport: () => undefined,
    onImport: () => undefined,
    onLoadPortDemoSample: () => undefined,
    onLoadRenderSample: () => undefined,
    onLoadSendReceivePanelSample: () => undefined,
    onLoadShaderMultiUniformSample: () => undefined,
    onLoadShaderUniformSample: () => undefined,
    onModeChange: () => undefined,
    onOpenProject: () => undefined,
    onReset: () => undefined,
    onSaveProject: () => undefined,
    ...props
  });
}

function findElementsByType(
  node: ReactNode,
  type: unknown
): ReactElement<{ children?: ReactNode; label?: string; onChange?: (value: string) => void }>[] {
  if (!isValidElement(node)) {
    return [];
  }

  const current =
    node.type === type
      ? [node as ReactElement<{ children?: ReactNode; label?: string; onChange?: (value: string) => void }>]
      : [];
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    return [...current, ...children.flatMap((child) => findElementsByType(child, type))];
  }

  return [...current, ...findElementsByType(children, type)];
}
