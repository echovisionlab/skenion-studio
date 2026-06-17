import type { GraphNodeV01 } from "@skenion/contracts";
import type { RuntimeControlValue } from "../runtime/types";

export const SEND_F32_NODE_KIND = "core.send-f32";
export const RECEIVE_F32_NODE_KIND = "core.receive-f32";
export const SEND_I32_NODE_KIND = "core.send-i32";
export const RECEIVE_I32_NODE_KIND = "core.receive-i32";
export const SEND_BOOL_NODE_KIND = "core.send-bool";
export const RECEIVE_BOOL_NODE_KIND = "core.receive-bool";
export const SEND_RGBA_NODE_KIND = "core.send-rgba";
export const RECEIVE_RGBA_NODE_KIND = "core.receive-rgba";

const DEFAULT_CHANNEL_NAME = "channel";

export function isSendNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return Boolean(node && sendDataKind(node.kind));
}

export function isReceiveNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return Boolean(node && receiveDataKind(node.kind));
}

export function defaultSendParams(): Record<string, unknown> {
  return {
    name: DEFAULT_CHANNEL_NAME
  };
}

export function defaultReceiveParams(kind: string): Record<string, unknown> {
  return {
    name: DEFAULT_CHANNEL_NAME,
    default: defaultValueForDataKind(receiveDataKind(kind) ?? "number.f32")
  };
}

export function readChannelNameParam(node: GraphNodeV01): string {
  return typeof node.params.name === "string" && node.params.name.trim().length > 0
    ? node.params.name
    : DEFAULT_CHANNEL_NAME;
}

export function readReceiveDefaultValue(node: GraphNodeV01): RuntimeControlValue {
  return runtimeValueForDataKind(receiveDataKind(node.kind) ?? "number.f32", node.params.default);
}

export function sendDataKind(kind: string): string | null {
  switch (kind) {
    case SEND_F32_NODE_KIND:
      return "number.f32";
    case SEND_I32_NODE_KIND:
      return "number.i32";
    case SEND_BOOL_NODE_KIND:
      return "boolean";
    case SEND_RGBA_NODE_KIND:
      return "color.rgba";
    default:
      return null;
  }
}

export function receiveDataKind(kind: string): string | null {
  switch (kind) {
    case RECEIVE_F32_NODE_KIND:
      return "number.f32";
    case RECEIVE_I32_NODE_KIND:
      return "number.i32";
    case RECEIVE_BOOL_NODE_KIND:
      return "boolean";
    case RECEIVE_RGBA_NODE_KIND:
      return "color.rgba";
    default:
      return null;
  }
}

export function runtimeValueForDataKind(dataKind: string, value: unknown): RuntimeControlValue {
  if (dataKind === "number.f32") {
    return {
      type: "f32",
      value: typeof value === "number" && Number.isFinite(value) ? value : 0
    };
  }
  if (dataKind === "number.i32") {
    return {
      type: "i32",
      value: typeof value === "number" && Number.isInteger(value) ? value : 0
    };
  }
  if (dataKind === "boolean") {
    return {
      type: "bool",
      value: typeof value === "boolean" ? value : false
    };
  }
  if (dataKind === "color.rgba") {
    return {
      type: "rgba",
      value: readRgba(value)
    };
  }
  return {
    type: "f32",
    value: 0
  };
}

function defaultValueForDataKind(dataKind: string): unknown {
  return (runtimeValueForDataKind(dataKind, undefined) as RuntimeControlValue & { value: unknown }).value;
}

function readRgba(value: unknown): [number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 4) {
    return [1, 1, 1, 1];
  }
  const rgba = value.map((component) =>
    typeof component === "number" && Number.isFinite(component)
      ? Math.min(1, Math.max(0, component))
      : null
  );
  return rgba.some((component) => component === null)
    ? [1, 1, 1, 1]
    : rgba as [number, number, number, number];
}
