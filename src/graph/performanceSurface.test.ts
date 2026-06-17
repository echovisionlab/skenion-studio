import { describe, expect, it } from "vitest";
import type { GraphDocumentV01 } from "@skenion/contracts";
import {
  performanceControlPosition,
  performanceControlsFromGraph,
  performanceStatusModel,
  performanceSurfaceBounds,
  runtimeRequestForPerformanceControl,
  studioChromeVisibility
} from "./performanceSurface";
import { createViewStateFromPositions } from "./projectDocument";
import { sendReceivePanelSampleGraph, sendReceivePanelSampleViewState } from "../data/sampleGraph";
import type {
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../runtime/types";

describe("performance surface", () => {
  it("switches Studio chrome between editor and performance modes", () => {
    expect(studioChromeVisibility("editor")).toEqual({
      graphEditingEnabled: true,
      showInspector: true,
      showPalette: true
    });
    expect(studioChromeVisibility("performance")).toEqual({
      graphEditingEnabled: false,
      showInspector: false,
      showPalette: false
    });
  });

  it("extracts only ui controls from graph and sorts them by view state", () => {
    const controls = performanceControlsFromGraph(
      sendReceivePanelSampleGraph,
      sendReceivePanelSampleViewState
    );

    expect(controls.map((control) => [control.id, control.kind, control.label])).toEqual([
      ["slider_speed", "slider-f32", "Speed"],
      ["toggle_enabled", "toggle", "Enabled"]
    ]);
    expect(controls[0]?.slider).toEqual({ value: 0.75, min: 0, max: 2, step: 0.01 });
    expect(controls[1]?.toggle).toEqual({ value: true });
  });

  it("supports button controls and default positions", () => {
    const graph: GraphDocumentV01 = {
      ...sendReceivePanelSampleGraph,
      nodes: [
        {
          id: "button_1",
          kind: "ui.button",
          kindVersion: "0.1.0",
          params: { label: "Pulse" },
          ports: []
        },
        sendReceivePanelSampleGraph.nodes[0]!
      ],
      edges: []
    };
    const controls = performanceControlsFromGraph(graph, createViewStateFromPositions(graph, {}));

    expect(controls.map((control) => control.id)).toEqual(["button_1", "slider_speed"]);
    expect(runtimeRequestForPerformanceControl(controls[0]!)).toEqual({
      nodeId: "button_1",
      portId: "bang",
      value: { type: "bang" }
    });
  });

  it("falls back to origin for missing view-state entries and uses stable tie sorting", () => {
    const graph: GraphDocumentV01 = {
      ...sendReceivePanelSampleGraph,
      nodes: [
        {
          id: "button_b",
          kind: "ui.button",
          kindVersion: "0.1.0",
          params: { label: "B" },
          ports: []
        },
        {
          id: "button_a",
          kind: "ui.button",
          kindVersion: "0.1.0",
          params: { label: "A" },
          ports: []
        },
        {
          id: "button_c",
          kind: "ui.button",
          kindVersion: "0.1.0",
          params: { label: "C" },
          ports: []
        }
      ],
      edges: []
    };
    const viewState = createViewStateFromPositions(graph, {
      button_a: { x: 20, y: 10 },
      button_b: { x: 20, y: 10 }
    });
    const controls = performanceControlsFromGraph(
      graph,
      {
        ...viewState,
        canvas: {
          ...viewState.canvas,
          nodes: {
            button_a: { x: 20, y: 10 },
            button_b: { x: 20, y: 10 }
          }
        }
      }
    );

    expect(controls.map((control) => [control.id, control.position])).toEqual([
      ["button_c", { x: 0, y: 0 }],
      ["button_a", { x: 20, y: 10 }],
      ["button_b", { x: 20, y: 10 }]
    ]);
  });

  it("computes bounds and normalized positions for a view-state control surface", () => {
    const controls = performanceControlsFromGraph(
      sendReceivePanelSampleGraph,
      sendReceivePanelSampleViewState
    );
    const bounds = performanceSurfaceBounds(controls);

    expect(bounds).toEqual({ minX: 64, minY: 64, width: 640, height: 496 });
    expect(performanceControlPosition(controls[0]!, bounds)).toEqual({ left: 24, top: 24 });
    expect(performanceControlPosition(controls[1]!, bounds)).toEqual({ left: 24, top: 368 });
  });

  it("uses empty bounds when no performance controls exist", () => {
    expect(performanceSurfaceBounds([])).toEqual({
      minX: 0,
      minY: 0,
      width: 640,
      height: 360
    });
  });

  it("creates runtime control event requests without graph mutations", () => {
    const controls = performanceControlsFromGraph(
      sendReceivePanelSampleGraph,
      sendReceivePanelSampleViewState
    );

    expect(runtimeRequestForPerformanceControl(controls[0]!, 1.25)).toEqual({
      nodeId: "slider_speed",
      portId: "value",
      value: { type: "f32", value: 1.25 }
    });
    expect(runtimeRequestForPerformanceControl(controls[0]!, Number.NaN)).toEqual({
      nodeId: "slider_speed",
      portId: "value",
      value: { type: "f32", value: 0.75 }
    });
    expect(runtimeRequestForPerformanceControl({ ...controls[0]!, slider: undefined })).toEqual({
      nodeId: "slider_speed",
      portId: "value",
      value: { type: "f32", value: 0 }
    });
    expect(runtimeRequestForPerformanceControl(controls[1]!)).toEqual({
      nodeId: "toggle_enabled",
      portId: "value",
      value: { type: "bang" }
    });
  });

  it("summarizes runtime, session, preview, control, and render status", () => {
    const session: RuntimeSessionResponse = {
      ok: true,
      loaded: true,
      graphId: "graph",
      graphRevision: "1",
      sessionRevision: 2,
      controlRevision: 3,
      diagnostics: [],
      plan: null,
      report: null
    };
    const previewStatus: RuntimePreviewStatus = {
      ok: true,
      state: "running",
      pid: 100,
      graphId: "graph",
      graphRevision: "1",
      sessionRevision: 2,
      previewSessionRevision: 2,
      controlRevision: 4,
      previewControlRevision: 4,
      controlLive: true,
      lastControlUpdateAt: "2026-06-17T00:00:00.000Z",
      stale: false,
      startedAt: "2026-06-17T00:00:00.000Z",
      exitedAt: null,
      exitCode: null,
      message: null,
      diagnostics: []
    };
    const telemetry = {
      render: {
        approxFps: 59.9,
        framesRendered: 120,
        lastError: null
      },
      diagnostics: [{ message: "nonfatal warning" }]
    } as RuntimeTelemetrySnapshot;

    expect(
      performanceStatusModel({
        previewStatus,
        runtimeStatus: "connected",
        session,
        sessionSynced: true,
        telemetry
      })
    ).toMatchObject({
      controlLabel: "control live",
      controlRevision: 4,
      fps: 59.9,
      framesRendered: 120,
      lastError: "nonfatal warning",
      previewControlRevision: 4,
      previewLabel: "running",
      previewStale: false,
      runtimeLabel: "connected",
      sessionLabel: "synced"
    });
  });

  it("summarizes unavailable runtime status", () => {
    expect(
      performanceStatusModel({
        previewStatus: null,
        runtimeStatus: "disconnected",
        session: null,
        sessionSynced: false,
        telemetry: null
      })
    ).toEqual({
      controlLabel: "control not live",
      controlRevision: null,
      fps: null,
      framesRendered: null,
      lastError: null,
      previewControlRevision: null,
      previewLabel: "stopped",
      previewStale: false,
      runtimeLabel: "disconnected",
      sessionLabel: "not loaded"
    });
  });

  it("labels a loaded but unsynced session and prefers render errors", () => {
    const session = {
      ok: true,
      loaded: true,
      graphId: "graph",
      graphRevision: "1",
      sessionRevision: 2,
      controlRevision: 8,
      diagnostics: [],
      plan: null,
      report: null
    } satisfies RuntimeSessionResponse;
    const telemetry = {
      render: {
        approxFps: null,
        framesRendered: 12,
        lastError: "shader failed"
      },
      diagnostics: [{ message: "runtime warning" }]
    } as RuntimeTelemetrySnapshot;

    expect(
      performanceStatusModel({
        previewStatus: null,
        runtimeStatus: "connected",
        session,
        sessionSynced: false,
        telemetry
      })
    ).toMatchObject({
      controlRevision: 8,
      lastError: "shader failed",
      sessionLabel: "not synced"
    });
  });
});
