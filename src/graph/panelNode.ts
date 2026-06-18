import type { GraphNodeV01 } from "@skenion/contracts";

export const PANEL_NODE_KIND = "core.panel";
export const DEFAULT_PANEL_COLOR = "transparent";

export function isPanelNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === PANEL_NODE_KIND;
}

export function defaultPanelParams(): Record<string, unknown> {
  return {
    label: "Panel",
    color: DEFAULT_PANEL_COLOR
  };
}

export function readPanelParams(node: GraphNodeV01): { label: string; color: string } {
  return {
    label: typeof node.params.label === "string" ? node.params.label : "",
    color: readPanelColor(node.params.color)
  };
}

function readPanelColor(value: unknown): string {
  return typeof value === "string" && (value === "transparent" || /^#[0-9a-f]{6}$/i.test(value))
    ? value
    : DEFAULT_PANEL_COLOR;
}
