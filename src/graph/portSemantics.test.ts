import { describe, expect, it } from "vitest";
import type { ConversionPlanV01 } from "@skenion/contracts";
import type {
  DisplayEdgeV01 as EdgeV01,
  DisplayGraphDocumentV01 as GraphDocumentV01,
  DisplayGraphNodeV01 as GraphNodeV01
} from "./patchLibrary";
import { graphPortToPortSpec } from "./patchLibrary";
import { renderSampleGraph, sampleGraph } from "../data/sampleGraph";
import {
  analyzeGraphPortSemantics,
  connectionSemanticCheck,
  conversionPreviewForPlan,
  edgeId,
  edgeInspectorModel,
  findEdgeInspectorModel,
  portSemanticsForPort,
  semanticTypeColor
} from "./portSemantics";

describe("port and edge semantics", () => {
  it("derives current 0.1 artist-facing port metadata from persisted ports", () => {
    const shader = renderSampleGraph.nodes[0];
    const out = shader.ports.find((port) => port.id === "out")!;
    const uniform = shader.ports.find((port) => port.id === "speed")!;
    const colorUniform = shader.ports.find((port) => port.id === "tint")!;
    const semantics = portSemanticsForPort(shader, out);
    const uniformSemantics = portSemanticsForPort(shader, uniform);
    const colorSemantics = portSemanticsForPort(shader, colorUniform);

    expect(semantics).toMatchObject({
      direction: "output",
      fanOutPolicy: "allow",
      maxConnections: null,
      mergePolicy: "forbid",
      rate: "render",
      required: false,
      storedType: "resource<value.core.tensor>",
      triggerMode: "passive",
      type: "render.frame"
    });
    expect(uniformSemantics).toMatchObject({
      direction: "input",
      maxConnections: 1,
      mergePolicy: "forbid",
      rate: "control",
      required: false,
      storedType: "value<number.float>",
      type: "value.number.float"
    });
    expect(colorSemantics).toMatchObject({
      direction: "input",
      storedType: "value<color>",
      type: "value.color"
    });
    expect(semanticTypeColor("render.frame")).toBe("#d6336c");
    expect(semanticTypeColor("gpu.texture2d")).toBe("#7048e8");
    expect(semanticTypeColor("value.color")).toBe("#e64980");
    expect(semanticTypeColor("event.bang")).toBe("#f08c00");
    expect(semanticTypeColor("signal.audio")).toBe("#0ca678");
    expect(semanticTypeColor("stream.video.frame")).toBe("#1c7ed6");
    expect(semanticTypeColor("resource.asset.video")).toBe("#7950f2");
    expect(semanticTypeColor("value.number.float")).toBe("#495057");
  });

  it("preserves direct render frame and signal data kind labels", () => {
    const node: GraphNodeV01 = {
      id: "adapter",
      kind: "core.subpatch",
      kindVersion: "0.1.0",
      params: {},
      ports: [
        {
          id: "frame",
          direction: "output",
          type: { flow: "resource", dataKind: "render.frame" }
        },
        {
          id: "audio",
          direction: "output",
          type: { flow: "signal", dataKind: "signal.audio" }
        }
      ]
    };

    expect(portSemanticsForPort(node, node.ports[0]!).type).toBe("render.frame");
    expect(portSemanticsForPort(node, node.ports[1]!).type).toBe("signal.audio");
  });

  it("shows core value storage kinds as artist-facing port labels", () => {
    const node: GraphNodeV01 = {
      id: "adapter",
      kind: "core.subpatch",
      kindVersion: "0.1.0",
      params: {},
      ports: [
        {
          id: "message",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.message" }
        },
        {
          id: "string",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.string" }
        },
        {
          id: "bool",
          direction: "input",
          type: { flow: "control", dataKind: "boolean" }
        },
        {
          id: "f8",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.float8" }
        },
        {
          id: "f16",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.float16" }
        },
        {
          id: "i8",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.int8" }
        },
        {
          id: "i16",
          direction: "input",
          type: { flow: "control", dataKind: "value.core.int16" }
        }
      ]
    };

    expect(portSemanticsForPort(node, node.ports[0]!)).toMatchObject({
      storedType: "value<message.any>",
      type: "value.message.any"
    });
    expect(portSemanticsForPort(node, node.ports[1]!)).toMatchObject({
      storedType: "value<string>",
      type: "value.string"
    });
    expect(portSemanticsForPort(node, node.ports[3]!).type).toBe("value.number.float");
    expect(portSemanticsForPort(node, node.ports[4]!).type).toBe("value.number.float");
    expect(portSemanticsForPort(node, node.ports[5]!).type).toBe("value.number.int");
    expect(portSemanticsForPort(node, node.ports[6]!).type).toBe("value.number.int");
    expect(
      analyzeGraphPortSemantics({
        schema: "skenion.graph",
        schemaVersion: "0.1.0",
        id: "canonical-control",
        revision: "1",
        nodes: [
          {
            id: "source",
            kind: "core.message",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "out",
                direction: "output",
                type: { flow: "control", dataKind: "message.any" }
              }
            ]
          },
          {
            id: "target",
            kind: "core.string",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "in",
                direction: "input",
                type: { flow: "control", dataKind: "string" }
              }
            ]
          }
        ],
        edges: [{ from: { node: "source", port: "out" }, to: { node: "target", port: "in" } }]
      })[0]
    ).toMatchObject({ code: "incompatible-edge-type" });
    expect(
      analyzeGraphPortSemantics({
        schema: "skenion.graph",
        schemaVersion: "0.1.0",
        id: "canonical-bool",
        revision: "1",
        nodes: [
          {
            id: "source",
            kind: "core.bool",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "out",
                direction: "output",
                type: { flow: "control", dataKind: "boolean" }
              }
            ]
          },
          {
            id: "target",
            kind: "core.bool",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "in",
                direction: "input",
                type: { flow: "control", dataKind: "boolean" }
              }
            ]
          }
        ],
        edges: [{ from: { node: "source", port: "out" }, to: { node: "target", port: "in" } }]
      })
    ).toEqual([]);
  });

  it("allows scalar value outputs to message selector inlets", () => {
    const target = sampleGraph.nodes.find((node) => node.id === "target_1")!;
    const targetIn = target.ports.find((port) => port.id === "in")!;
    const issues = analyzeGraphPortSemantics(sampleGraph);
    const inspector = edgeInspectorModel(sampleGraph, sampleGraph.edges[0]!);

    expect(graphPortToPortSpec(targetIn).type).toBe("value.core.message");
    expect(issues).not.toContainEqual(expect.objectContaining({ code: "incompatible-edge-type" }));
    expect(inspector.targetPort).toMatchObject({
      storedType: "event<message.any>",
      type: "message.any"
    });
    expect(inspector.conversion).toMatchObject({
      policies: ["message-selector"],
      issues: []
    });
  });

  it("canonicalizes UI value data kinds before conversion preview planning", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "canonical-value-preview",
      revision: "1",
      nodes: [
        controlNode("int_source", "output", "number.int", "i32"),
        controlNode("int_target", "input", "number.int", "i64"),
        controlNode("uint_source", "output", "number.uint", "u8"),
        controlNode("uint_target", "input", "number.uint", "u16"),
        controlNode("bool_source", "output", "boolean"),
        controlNode("bool_target", "input", "boolean"),
        controlNode("message_source", "output", "message.any"),
        controlNode("message_target", "input", "message.any"),
        controlNode("string_source", "output", "string"),
        controlNode("string_target", "input", "string"),
        controlNode("custom_source", "output", "value.acme.payload"),
        controlNode("custom_target", "input", "value.acme.payload"),
        eventNode("bang_source", "output", "event.bang"),
        eventNode("bang_target", "input", "event.bang"),
        eventNode("event_message_source", "output", "message.any"),
        eventNode("event_message_target", "input", "message.any"),
        controlNode("float_default_source", "output", "number.float"),
        controlNode("float_default_target", "input", "number.float")
      ],
      edges: [
        { from: { node: "int_source", port: "out" }, to: { node: "int_target", port: "in" } },
        { from: { node: "uint_source", port: "out" }, to: { node: "uint_target", port: "in" } },
        { from: { node: "bool_source", port: "out" }, to: { node: "bool_target", port: "in" } },
        {
          from: { node: "message_source", port: "out" },
          to: { node: "message_target", port: "in" }
        },
        {
          from: { node: "string_source", port: "out" },
          to: { node: "string_target", port: "in" }
        },
        {
          from: { node: "custom_source", port: "out" },
          to: { node: "custom_target", port: "in" }
        },
        {
          from: { node: "bang_source", port: "out" },
          to: { node: "bang_target", port: "in" }
        },
        {
          from: { node: "event_message_source", port: "out" },
          to: { node: "event_message_target", port: "in" }
        },
        {
          from: { node: "float_default_source", port: "out" },
          to: { node: "float_default_target", port: "in" }
        }
      ]
    };

    expect(edgeInspectorModel(graph, graph.edges[0]!).conversion).toMatchObject({
      source: "number.int/i32",
      target: "number.int/i64",
      issues: [
        expect.stringContaining("implicit-lossy-conversion")
      ]
    });
    expect(edgeInspectorModel(graph, graph.edges[1]!).conversion).toMatchObject({
      source: "number.uint/u8",
      target: "number.uint/u16",
      issues: [
        expect.stringContaining("implicit-lossy-conversion")
      ]
    });
    expect(edgeInspectorModel(graph, graph.edges[2]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[3]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[4]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[5]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[6]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[7]!).conversion).toBeNull();
    expect(edgeInspectorModel(graph, graph.edges[8]!).conversion).toBeNull();
  });

  it("formats all Contracts conversion policy attributes for the edge inspector", () => {
    const plan = {
      ok: true,
      source: { flow: "control", dataKind: "value.core.float32", representation: "f32" },
      target: { flow: "control", dataKind: "value.core.int32", representation: "i32" },
      lossy: true,
      steps: [
        {
          policy: "float-to-integer",
          clamp: "saturating",
          trunc: "toward-zero"
        }
      ],
      issues: [
        {
          severity: "warning",
          code: "implicit-lossy-conversion",
          message: "float32 to int32 uses truncation"
        }
      ]
    } as unknown as ConversionPlanV01;

    expect(conversionPreviewForPlan(plan)).toEqual({
      source: "number.float/f32",
      target: "number.int/i32",
      lossy: true,
      policies: ["float-to-integer clamp=saturating trunc=toward-zero"],
      issues: ["implicit-lossy-conversion: float32 to int32 uses truncation"]
    });
  });

  it("builds edge inspector metadata with current defaults and explicit overrides", () => {
    const edge = {
      ...renderSampleGraph.edges[0],
      id: "explicit_edge",
      order: 2,
      enabled: false,
      adapter: "adapter.example",
      feedback: { enabled: true, boundary: "render-frame", bufferMode: "latest" },
      styleOverride: "feedback"
    } as EdgeV01 & {
      id: string;
      order: number;
      enabled: boolean;
      adapter: string;
      feedback: { enabled: boolean; boundary: "render-frame"; bufferMode: "latest" };
      styleOverride: string;
    };
    const graph: GraphDocumentV01 = {
      ...renderSampleGraph,
      edges: [edge]
    };

    expect(edgeId(edge)).toBe("explicit_edge");
    expect(edgeInspectorModel(graph, edge)).toMatchObject({
      id: "explicit_edge",
      source: "shader_1.out",
      target: "output_1.in",
      resolvedType: "render.frame",
      order: 2,
      enabled: false,
      adapter: "adapter.example",
      feedback: { boundary: "render-frame" },
      styleOverride: "feedback"
    });
    expect(findEdgeInspectorModel(graph, null)).toBeNull();
    expect(findEdgeInspectorModel(graph, "explicit_edge")?.feedback?.boundary).toBe("render-frame");
    expect(findEdgeInspectorModel(graph, "missing")).toBeNull();
  });

  it("reports numeric type differences through the connection policy", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "conversion-preview",
      revision: "1",
      nodes: [
        {
          id: "float_1",
          kind: "core.float",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "control", dataKind: "number.float", format: "f32" }
            }
          ]
        },
        {
          id: "uint_1",
          kind: "core.uint",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "control", dataKind: "number.uint", format: "u8" },
              activation: "trigger"
            }
          ]
        }
      ],
      edges: [{ from: { node: "float_1", port: "value" }, to: { node: "uint_1", port: "in" } }]
    };

    const conversion = edgeInspectorModel(graph, graph.edges[0]!).conversion;

    expect(conversion).toMatchObject({
      source: "value.number.float",
      target: "value.number.uint",
      lossy: false,
      policies: [],
      issues: ["incompatible-type"]
    });
    expect(analyzeGraphPortSemantics(graph)).toMatchObject([
      {
        code: "incompatible-edge-type",
        edgeId: "float_1.value->uint_1.in"
      }
    ]);
  });

  it("reports signedness and color format differences through the connection policy", () => {
    const graph: GraphDocumentV01 = {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "conversion-policy-shapes",
      revision: "1",
      nodes: [
        {
          id: "int_1",
          kind: "core.int",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "control", dataKind: "number.int", format: "i32" }
            }
          ]
        },
        {
          id: "uint_1",
          kind: "core.uint",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "control", dataKind: "number.uint", format: "u8" },
              activation: "trigger"
            }
          ]
        },
        {
          id: "color_1",
          kind: "core.color",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "control", dataKind: "color", format: "rgba32f" }
            }
          ]
        },
        {
          id: "color_target_1",
          kind: "core.color-target",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "in",
              direction: "input",
              type: { flow: "control", dataKind: "color", format: "rgba8unorm" },
              activation: "trigger"
            }
          ]
        }
      ],
      edges: [
        { from: { node: "int_1", port: "value" }, to: { node: "uint_1", port: "in" } },
        { from: { node: "color_1", port: "value" }, to: { node: "color_target_1", port: "in" } }
      ]
    };

    expect(edgeInspectorModel(graph, graph.edges[0]!).conversion?.issues).toEqual([
      "incompatible-type"
    ]);
    expect(edgeInspectorModel(graph, graph.edges[1]!).conversion?.policies).toEqual([
      "color-cast clamp=unit quantize sanitize=nan-inf-to-finite"
    ]);
    expect(analyzeGraphPortSemantics(graph)).toMatchObject([
      {
        code: "incompatible-edge-type",
        edgeId: "int_1.value->uint_1.in"
      }
    ]);
  });

  it("reports fan-in and type issues without mutating graph documents", () => {
    const duplicateTarget: GraphDocumentV01 = {
      ...sampleGraph,
      edges: [
        sampleGraph.edges[0],
        sampleGraph.edges[0]
      ]
    };

    const issues = analyzeGraphPortSemantics(duplicateTarget);

    expect(issues.map((issue) => issue.code)).toEqual([
      "fan-in-forbidden"
    ]);
    expect(
      connectionSemanticCheck(sampleGraph, {
        type: "addEdge",
        edge: sampleGraph.edges[0]
      })
    ).toMatchObject({ code: "fan-in-forbidden" });
    expect(connectionSemanticCheck(sampleGraph, null)).toBeNull();

    const mergeForbiddenTarget: GraphDocumentV01 = {
      ...sampleGraph,
      nodes: sampleGraph.nodes.map((node) =>
        node.id === "target_1"
          ? {
              ...node,
              ports: [
                {
                  ...node.ports[0],
                  maxConnections: 3,
                  mergePolicy: "forbid"
                } as GraphNodeV01["ports"][number] & { maxConnections: number; mergePolicy: string }
              ]
            }
          : node
      ),
      edges: [sampleGraph.edges[0], sampleGraph.edges[0]]
    };
    expect(analyzeGraphPortSemantics(mergeForbiddenTarget).map((issue) => issue.code)).toEqual([
      "fan-in-forbidden"
    ]);
  });

  it("classifies missing endpoints, direction errors, and explicit feedback cycles", () => {
    const graph = twoNodeValueCycle();
    const feedbackEdge = {
      ...graph.edges[1],
      feedback: { enabled: true, boundary: "render-frame" }
    } as EdgeV01 & { feedback: { enabled: boolean; boundary: "render-frame" } };
    const feedbackGraph = {
      ...graph,
      edges: [graph.edges[0], feedbackEdge]
    };
    const invalidDirection: GraphDocumentV01 = {
      ...graph,
      edges: [
        {
          from: { node: "a", port: "in" },
          to: { node: "b", port: "in" }
        },
        {
          from: { node: "missing", port: "out" },
          to: { node: "b", port: "in" }
        }
      ]
    };

    expect(analyzeGraphPortSemantics(graph).map((issue) => issue.code)).toContain(
      "ambiguous-algebraic-loop"
    );
    expect(analyzeGraphPortSemantics(twoNodeStreamCycle()).map((issue) => issue.code)).toContain(
      "invalid-cycle"
    );
    expect(analyzeGraphPortSemantics(feedbackGraph).map((issue) => issue.code)).toContain(
      "feedback-cycle"
    );
    expect(analyzeGraphPortSemantics(invalidDirection).map((issue) => issue.code)).toEqual([
      "invalid-edge-direction",
      "missing-edge-endpoint"
    ]);
  });
});

function controlNode(
  id: string,
  direction: "input" | "output",
  dataKind: string,
  format?: string
): GraphNodeV01 {
  const portId = direction === "input" ? "in" : "out";
  return {
    id,
    kind: `core.${id}`,
    kindVersion: "0.1.0",
    params: {},
    ports: [
      {
        id: portId,
        direction,
        type: {
          flow: "control",
          dataKind,
          ...(format ? { format } : {})
        }
      }
    ]
  };
}

function eventNode(
  id: string,
  direction: "input" | "output",
  dataKind: "event.bang" | "message.any"
): GraphNodeV01 {
  const portId = direction === "input" ? "in" : "out";
  return {
    id,
    kind: `core.${id}`,
    kindVersion: "0.1.0",
    params: {},
    ports: [
      {
        id: portId,
        direction,
        type: {
          flow: "event",
          dataKind
        }
      }
    ]
  };
}

function twoNodeValueCycle(): GraphDocumentV01 {
  const ports: GraphNodeV01["ports"] = [
    {
      id: "in",
      direction: "input",
      type: { flow: "control", dataKind: "number.float" },
      activation: "latched"
    },
    {
      id: "out",
      direction: "output",
      type: { flow: "control", dataKind: "number.float" }
    }
  ];

  return {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "cycle",
    revision: "1",
    nodes: [
      { id: "a", kind: "core.value-transform", kindVersion: "0.1.0", params: {}, ports },
      { id: "b", kind: "core.value-transform", kindVersion: "0.1.0", params: {}, ports }
    ],
    edges: [
      { from: { node: "a", port: "out" }, to: { node: "b", port: "in" } },
      { from: { node: "b", port: "out" }, to: { node: "a", port: "in" } }
    ]
  };
}

function twoNodeStreamCycle(): GraphDocumentV01 {
  const ports: GraphNodeV01["ports"] = [
    {
      id: "in",
      direction: "input",
      type: { flow: "stream", dataKind: "video.frame" },
      activation: "latched"
    },
    {
      id: "out",
      direction: "output",
      type: { flow: "stream", dataKind: "video.frame" }
    }
  ];

  return {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "stream-cycle",
    revision: "1",
    nodes: [
      { id: "a", kind: "core.stream-transform", kindVersion: "0.1.0", params: {}, ports },
      { id: "b", kind: "core.stream-transform", kindVersion: "0.1.0", params: {}, ports }
    ],
    edges: [
      { from: { node: "a", port: "out" }, to: { node: "b", port: "in" } },
      { from: { node: "b", port: "out" }, to: { node: "a", port: "in" } }
    ]
  };
}
