import type { GraphDocumentV01, GraphNodeV01, ViewStateV01 } from "@skenion/contracts";
import {
  readPanelLabelParam,
  readUiSliderParams,
  readUiToggleValue,
  UI_BUTTON_NODE_KIND,
  UI_SLIDER_F32_NODE_KIND,
  UI_TOGGLE_NODE_KIND
} from "./panelControls";
import { viewPositionsFromViewState } from "./projectDocument";
import type {
  RuntimeConnectionStatus,
  RuntimeControlEventRequest,
  RuntimePreviewState,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../runtime/types";

export type StudioMode = "editor" | "performance";
export type PerformanceControlKind = "button" | "slider-f32" | "toggle";

export interface StudioChromeVisibility {
  graphEditingEnabled: boolean;
  showInspector: boolean;
  showPalette: boolean;
}

export interface PerformanceControlModel {
  id: string;
  kind: PerformanceControlKind;
  label: string;
  node: GraphNodeV01;
  position: {
    x: number;
    y: number;
  };
  slider?: {
    value: number;
    min: number;
    max: number;
    step: number;
  };
  toggle?: {
    value: boolean;
  };
}

export interface PerformanceSurfaceBounds {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface PerformanceStatusModel {
  controlLabel: string;
  controlRevision: number | null;
  fps: number | null;
  framesRendered: number | null;
  lastError: string | null;
  previewControlRevision: number | null;
  previewLabel: RuntimePreviewState;
  previewStale: boolean;
  runtimeLabel: RuntimeConnectionStatus;
  sessionLabel: string;
}

const CONTROL_CARD_WIDTH = 260;
const CONTROL_CARD_HEIGHT = 104;
const CONTROL_SURFACE_PADDING = 24;

export function studioChromeVisibility(mode: StudioMode): StudioChromeVisibility {
  return mode === "editor"
    ? {
        graphEditingEnabled: true,
        showInspector: true,
        showPalette: true
      }
    : {
        graphEditingEnabled: false,
        showInspector: false,
        showPalette: false
      };
}

export function performanceControlsFromGraph(
  graph: GraphDocumentV01,
  viewState: ViewStateV01
): PerformanceControlModel[] {
  const positions = viewPositionsFromViewState(viewState);
  return graph.nodes
    .flatMap((node) => performanceControlFromNode(node, positions[node.id] ?? { x: 0, y: 0 }))
    .sort((left, right) =>
      left.position.y - right.position.y ||
      left.position.x - right.position.x ||
      left.id.localeCompare(right.id)
    );
}

export function performanceSurfaceBounds(
  controls: PerformanceControlModel[]
): PerformanceSurfaceBounds {
  if (controls.length === 0) {
    return {
      minX: 0,
      minY: 0,
      width: 640,
      height: 360
    };
  }

  const xs = controls.map((control) => control.position.x);
  const ys = controls.map((control) => control.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs) + CONTROL_CARD_WIDTH;
  const maxY = Math.max(...ys) + CONTROL_CARD_HEIGHT;
  return {
    minX,
    minY,
    width: Math.max(640, maxX - minX + CONTROL_SURFACE_PADDING * 2),
    height: Math.max(360, maxY - minY + CONTROL_SURFACE_PADDING * 2)
  };
}

export function performanceControlPosition(
  control: PerformanceControlModel,
  bounds: PerformanceSurfaceBounds
) {
  return {
    left: control.position.x - bounds.minX + CONTROL_SURFACE_PADDING,
    top: control.position.y - bounds.minY + CONTROL_SURFACE_PADDING
  };
}

export function runtimeRequestForPerformanceControl(
  control: PerformanceControlModel,
  value?: number
): RuntimeControlEventRequest {
  switch (control.kind) {
    case "button":
      return {
        nodeId: control.id,
        portId: "bang",
        value: { type: "bang" }
      };
    case "slider-f32":
      return {
        nodeId: control.id,
        portId: "value",
        value: {
          type: "f32",
          value: typeof value === "number" && Number.isFinite(value) ? value : control.slider?.value ?? 0
        }
      };
    case "toggle":
      return {
        nodeId: control.id,
        portId: "value",
        value: { type: "bang" }
      };
  }
}

export function performanceStatusModel({
  previewStatus,
  runtimeStatus,
  session,
  sessionSynced,
  telemetry
}: {
  previewStatus: RuntimePreviewStatus | null;
  runtimeStatus: RuntimeConnectionStatus;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  telemetry: RuntimeTelemetrySnapshot | null;
}): PerformanceStatusModel {
  return {
    controlLabel: previewStatus?.controlLive ? "control live" : "control not live",
    controlRevision: previewStatus?.controlRevision ?? session?.controlRevision ?? null,
    fps: telemetry?.render.approxFps ?? null,
    framesRendered: telemetry?.render.framesRendered ?? null,
    lastError: telemetry?.render.lastError ?? telemetry?.diagnostics[0]?.message ?? null,
    previewControlRevision: previewStatus?.previewControlRevision ?? null,
    previewLabel: previewStatus?.state ?? "stopped",
    previewStale: previewStatus?.stale ?? false,
    runtimeLabel: runtimeStatus,
    sessionLabel: session?.loaded ? (sessionSynced ? "synced" : "not synced") : "not loaded"
  };
}

function performanceControlFromNode(
  node: GraphNodeV01,
  position: { x: number; y: number }
): PerformanceControlModel[] {
  if (node.kind === UI_BUTTON_NODE_KIND) {
    return [
      {
        id: node.id,
        kind: "button",
        label: readPanelLabelParam(node),
        node,
        position
      }
    ];
  }

  if (node.kind === UI_SLIDER_F32_NODE_KIND) {
    const params = readUiSliderParams(node);
    return [
      {
        id: node.id,
        kind: "slider-f32",
        label: params.label,
        node,
        position,
        slider: {
          max: params.max,
          min: params.min,
          step: params.step,
          value: params.value
        }
      }
    ];
  }

  if (node.kind === UI_TOGGLE_NODE_KIND) {
    return [
      {
        id: node.id,
        kind: "toggle",
        label: readPanelLabelParam(node),
        node,
        position,
        toggle: {
          value: readUiToggleValue(node)
        }
      }
    ];
  }

  return [];
}
