import type { GraphNodeV01 } from "@skenion/contracts";
import { readStringValueParam } from "./stringValue";

export const MESSAGE_NODE_KIND = "core.message";

export function isMessageNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === MESSAGE_NODE_KIND;
}

export function defaultMessageParams(): Record<string, unknown> {
  return {
    value: ""
  };
}

export function readMessageValueParam(node: GraphNodeV01): string {
  return readStringValueParam(node);
}
