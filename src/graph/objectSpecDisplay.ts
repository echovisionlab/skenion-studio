import type { DisplayGraphNodeV01 } from "./patchLibrary";

export function genericObjectSpecForNode(node: DisplayGraphNodeV01): string {
  return (
    stringParam(node.objectSpec) ??
    stringParam(node.params.label) ??
    node.kind
  );
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
