import { describe, expect, it } from "vitest";
import type { GraphPatch } from "../graph/skenionGraph";
import {
  runtimeCommandGroupsFromGraphPatches,
  runtimeGraphCommandPayloadForPatchGroup
} from "./liveGraphPatches";

describe("live graph patch command conversion", () => {
  it("converts cable creation to a Runtime graph.changeSet command", () => {
    const groups = runtimeCommandGroupsFromGraphPatches([
      {
        type: "addEdge",
        edge: {
          from: { node: "source_1", port: "value" },
          to: { node: "float_1", port: "in" }
        }
      }
    ]);

    expect(groups).toHaveLength(1);
    const payload = runtimeGraphCommandPayloadForPatchGroup(groups![0], "7", 11);

    expect(payload).toMatchObject({
      kind: "graph.changeSet",
      baseGraphRevision: "7",
      baseSessionRevision: 11,
      target: { path: { kind: "root" }, baseRevision: "7" },
      changes: [
        {
          op: "edge.connect",
          edge: {
            id: "edge_source_1_value_float_1_in",
            source: { nodeId: "source_1", portId: "value" },
            target: { nodeId: "float_1", portId: "in" }
          }
        }
      ]
    });
  });

  it("converts cable deletion to edge.disconnect by contract edge id", () => {
    const groups = runtimeCommandGroupsFromGraphPatches([
      {
        type: "removeEdge",
        edge: {
          from: { node: "source_1", port: "value" },
          to: { node: "float_1", port: "in" }
        }
      }
    ]);

    expect(groups).toHaveLength(1);
    const payload = runtimeGraphCommandPayloadForPatchGroup(groups![0], "8");

    expect(payload).toMatchObject({
      kind: "graph.changeSet",
      changes: [
        {
          op: "edge.disconnect",
          edgeId: "edge_source_1_value_float_1_in"
        }
      ]
    });
  });

  it("converts object parameter edits to Runtime node.update", () => {
    const groups = runtimeCommandGroupsFromGraphPatches([
      { type: "setNodeParam", nodeId: "float_1", key: "value", value: 0.25 },
      { type: "setNodeParam", nodeId: "float_1", key: "label", value: "Gain" }
    ]);

    expect(groups).toHaveLength(1);
    const payload = runtimeGraphCommandPayloadForPatchGroup(groups![0], "9");

    expect(payload).toMatchObject({
      kind: "node.update",
      baseGraphRevision: "9",
      nodeId: "float_1",
      params: {
        label: "Gain",
        value: 0.25
      }
    });
  });

  it("does not convert unsupported graph patches to live commands", () => {
    const unsupportedPatch = {
      type: "replaceNodeInterface",
      nodeId: "shader_1",
      ports: [],
      edgePolicy: "removeInvalidEdges"
    } satisfies GraphPatch;

    expect(runtimeCommandGroupsFromGraphPatches([unsupportedPatch])).toBeNull();
  });
});
