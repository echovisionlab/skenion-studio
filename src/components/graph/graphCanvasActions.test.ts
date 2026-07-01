import { describe, expect, it } from "vitest";
import type { Edge } from "@xyflow/react";
import { sampleGraph } from "../../data/sampleGraph";
import { createViewStateFromPositions } from "../../graph/projectDocument";
import {
  duplicateGraphNode,
  removeGraphEdgeById,
  removeGraphEdges,
  removeGraphNodes
} from "./graphCanvasActions";

describe("graph canvas action helpers", () => {
  it("removes selected graph edges through graph patches", () => {
    const edge = reactFlowEdge("edge_value_1_value_target_1_in", "value_1", "value", "target_1", "in");
    const result = removeGraphEdges(sampleGraph, [edge], new Set());

    expect(result.patches).toEqual([
      {
        type: "removeEdge",
        edge: {
          from: { node: "value_1", port: "value" },
          to: { node: "target_1", port: "in" }
        }
      }
    ]);
    expect(result.graph.edges).toHaveLength(sampleGraph.edges.length - 1);
  });

  it("skips edge removal when a node deletion owns the same edge", () => {
    const edge = reactFlowEdge("edge_value_1_value_target_1_in", "value_1", "value", "target_1", "in");
    const result = removeGraphEdges(sampleGraph, [edge], new Set(["value_1"]));

    expect(result.patches).toEqual([]);
    expect(result.graph).toBe(sampleGraph);
  });

  it("removes graph nodes and their incident edges", () => {
    const result = removeGraphNodes(sampleGraph, [{ id: "value_1" }]);

    expect(result.patches).toEqual([{ type: "removeNode", nodeId: "value_1" }]);
    expect(result.graph.nodes.some((node) => node.id === "value_1")).toBe(false);
    expect(result.graph.edges.some((edge) => edge.from.node === "value_1" || edge.to.node === "value_1")).toBe(false);
  });

  it("removes a context-menu edge by React Flow edge id", () => {
    const edge = reactFlowEdge("edge_value_1_value_target_1_in", "value_1", "value", "target_1", "in");
    const result = removeGraphEdgeById(sampleGraph, [edge], edge.id);

    expect(result?.patches[0]).toEqual({
      type: "removeEdge",
      edge: {
        from: { node: "value_1", port: "value" },
        to: { node: "target_1", port: "in" }
      }
    });
  });

  it("duplicates graph nodes with a new id and offset view state", () => {
    const viewState = createViewStateFromPositions(sampleGraph, {
      value_1: { x: 10, y: 20 }
    });
    const result = duplicateGraphNode(sampleGraph, viewState, "value_1");

    expect(result?.nodeId).toBe("value_1_2");
    expect(result?.patches[0]).toMatchObject({
      type: "addNode",
      node: { id: "value_1_2" }
    });
    expect(result?.viewState.canvas.nodes.value_1_2).toEqual({ x: 42, y: 52 });
  });
});

function reactFlowEdge(
  id: string,
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): Edge {
  return {
    id,
    source,
    sourceHandle,
    target,
    targetHandle
  };
}
