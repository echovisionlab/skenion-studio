import type { GraphNodeV01 } from "@skenion/contracts";
import type { GraphPatch } from "./skenionGraph";
import { BOOL_VALUE_NODE_KIND, defaultBoolValueParams } from "./boolValue";
import { COMMENT_NODE_KIND, defaultCommentParams } from "./commentNode";
import {
  RECEIVE_BOOL_NODE_KIND,
  RECEIVE_F32_NODE_KIND,
  RECEIVE_I32_NODE_KIND,
  RECEIVE_RGBA_NODE_KIND,
  SEND_BOOL_NODE_KIND,
  SEND_F32_NODE_KIND,
  SEND_I32_NODE_KIND,
  SEND_RGBA_NODE_KIND,
  defaultReceiveParams,
  defaultSendParams
} from "./controlRouting";
import { COLOR_RGBA_NODE_KIND, defaultColorRgbaParams } from "./colorRgba";
import { FLOAT_VALUE_NODE_KIND, defaultFloatValueParams } from "./floatValue";
import { FULLSCREEN_SHADER_NODE_KIND, defaultFullscreenShaderParams } from "./fullscreenShader";
import { INT_VALUE_NODE_KIND, defaultIntValueParams } from "./intValue";
import { MESSAGE_NODE_KIND, defaultMessageParams } from "./messageNode";
import {
  UI_BUTTON_NODE_KIND,
  UI_SLIDER_F32_NODE_KIND,
  UI_TOGGLE_NODE_KIND,
  defaultUiButtonParams,
  defaultUiSliderF32Params,
  defaultUiToggleParams
} from "./panelControls";
import { STRING_VALUE_NODE_KIND, defaultStringValueParams } from "./stringValue";
import { TOGGLE_NODE_KIND, defaultToggleParams } from "./toggleValue";

export const CLEAR_COLOR_NODE_KIND = "render.clear-color";
export const DEFAULT_CLEAR_COLOR = [0.05, 0.08, 0.12, 1] as const;
export type ClearColor = [number, number, number, number];

export function isClearColorNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === CLEAR_COLOR_NODE_KIND;
}

export function defaultParamsForNodeKind(kind: string): Record<string, unknown> {
  if (kind === CLEAR_COLOR_NODE_KIND) {
    return {
      color: [...DEFAULT_CLEAR_COLOR]
    };
  }
  if (kind === FULLSCREEN_SHADER_NODE_KIND) {
    return defaultFullscreenShaderParams();
  }
  if (kind === FLOAT_VALUE_NODE_KIND) {
    return defaultFloatValueParams();
  }
  if (kind === INT_VALUE_NODE_KIND) {
    return defaultIntValueParams();
  }
  if (kind === BOOL_VALUE_NODE_KIND) {
    return defaultBoolValueParams();
  }
  if (kind === COLOR_RGBA_NODE_KIND) {
    return defaultColorRgbaParams();
  }
  if (kind === STRING_VALUE_NODE_KIND) {
    return defaultStringValueParams();
  }
  if (kind === TOGGLE_NODE_KIND) {
    return defaultToggleParams();
  }
  if (kind === COMMENT_NODE_KIND) {
    return defaultCommentParams();
  }
  if (kind === MESSAGE_NODE_KIND) {
    return defaultMessageParams();
  }
  if (
    kind === SEND_F32_NODE_KIND ||
    kind === SEND_I32_NODE_KIND ||
    kind === SEND_BOOL_NODE_KIND ||
    kind === SEND_RGBA_NODE_KIND
  ) {
    return defaultSendParams();
  }
  if (
    kind === RECEIVE_F32_NODE_KIND ||
    kind === RECEIVE_I32_NODE_KIND ||
    kind === RECEIVE_BOOL_NODE_KIND ||
    kind === RECEIVE_RGBA_NODE_KIND
  ) {
    return defaultReceiveParams(kind);
  }
  if (kind === UI_BUTTON_NODE_KIND) {
    return defaultUiButtonParams();
  }
  if (kind === UI_SLIDER_F32_NODE_KIND) {
    return defaultUiSliderF32Params();
  }
  if (kind === UI_TOGGLE_NODE_KIND) {
    return defaultUiToggleParams();
  }

  return {};
}

export function readClearColorParam(node: GraphNodeV01): ClearColor {
  const color = node.params.color;
  if (!Array.isArray(color) || color.length !== 4) {
    return [...DEFAULT_CLEAR_COLOR];
  }

  const values = color.map((component) =>
    typeof component === "number" && Number.isFinite(component)
      ? clamp01(component)
      : null
  );
  if (values.some((component) => component === null)) {
    return [...DEFAULT_CLEAR_COLOR];
  }

  return values as ClearColor;
}

export function setClearColorParamPatch(nodeId: string, color: ClearColor): GraphPatch {
  return {
    type: "setNodeParam",
    nodeId,
    key: "color",
    value: color.map(clamp01)
  };
}

export function replaceClearColorComponent(
  color: ClearColor,
  index: number,
  value: number
): ClearColor {
  const next: ClearColor = [...color];
  next[index] = clamp01(value);
  return next;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
