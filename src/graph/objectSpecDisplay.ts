import type { DisplayGraphNodeV01 } from "./patchLibrary";
import { nativeAliasForObjectKind } from "./objectNode";

export function genericObjectSpecForNode(node: DisplayGraphNodeV01): string {
  return (
    stringParam(node.objectSpec) ??
    nativeAliasForObjectKind(node.kind) ??
    stringParam(node.params.label) ??
    node.kind
  );
}

function stringParam(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
