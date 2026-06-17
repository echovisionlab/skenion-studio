import type { GraphNodeV01 } from "@skenion/contracts";
import { readBoolValueParam } from "./boolValue";

export const TOGGLE_NODE_KIND = "core.toggle";

export function isToggleNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === TOGGLE_NODE_KIND;
}

export function defaultToggleParams(): Record<string, unknown> {
  return {
    value: false
  };
}

export function readToggleParam(node: GraphNodeV01): boolean {
  return readBoolValueParam(node);
}
