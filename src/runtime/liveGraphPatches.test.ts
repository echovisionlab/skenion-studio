import { describe, expect, it } from "vitest";
import type { GraphPatch } from "../graph/skenionGraph";
import {
  runtimeCommandGroupsFromGraphPatches,
  runtimeGraphCommandPayloadForPatchGroup,
  runtimeSessionWithAcceptedProject,
  withProjectGraphRevision
} from "./liveGraphPatches";
import type { ProjectDocumentV01 } from "@skenion/contracts";
import type { RuntimeGraphCommandResponse } from "./graphCommand";
import type { RuntimeSessionResponse } from "./types";

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

  it("converts node add and delete patches to Runtime change-set operations", () => {
    const groups = runtimeCommandGroupsFromGraphPatches([
      {
        type: "addNode",
        node: {
          id: "float 1",
          kind: "core.float",
          kindVersion: "0.1.0",
          implementation: {
            provider: { kind: "core" },
            objectId: "float",
            version: "0.1.0"
          },
          objectSpec: "float",
          params: { value: 0.5 },
          ports: [
            {
              id: "value",
              direction: "output",
              type: { flow: "control", dataKind: "number.float", format: "f32" }
            }
          ]
        }
      },
      {
        type: "removeNode",
        nodeId: "old float"
      }
    ]);

    expect(groups).toHaveLength(1);
    expect(runtimeGraphCommandPayloadForPatchGroup(groups![0], "12")).toMatchObject({
      kind: "graph.changeSet",
      changes: [
        {
          op: "node.add",
          changeId: "add-node-0-float-1",
          node: {
            id: "float 1",
            objectSpec: "float"
          }
        },
        {
          op: "node.delete",
          changeId: "delete-node-1-old-float",
          nodeId: "old float"
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

  it("keeps accepted Runtime project revisions and session counters authoritative", () => {
    const project = projectDocument("3");
    const acceptedProject = withProjectGraphRevision(project, "4");
    const unchangedProject = withProjectGraphRevision(acceptedProject, "4");
    const session: RuntimeSessionResponse = {
      ok: true,
      issues: [],
      report: null,
      snapshot: {
        sessionRevision: 7,
        viewRevision: 8,
        controlRevision: 9,
        project,
        bindingFormats: [],
        issues: [],
        plan: null
      }
    };
    const response = {
      payload: {
        sessionRevision: 10,
        viewRevision: 11
      }
    } as RuntimeGraphCommandResponse;

    expect(acceptedProject).not.toBe(project);
    expect(acceptedProject.revision).toBe("4");
    expect(acceptedProject.graph.revision).toBe("4");
    expect(unchangedProject).toBe(acceptedProject);
    expect(runtimeSessionWithAcceptedProject(null, acceptedProject, response)).toBeNull();
    expect(runtimeSessionWithAcceptedProject(session, acceptedProject, response)).toMatchObject({
      snapshot: {
        project: acceptedProject,
        sessionRevision: 10,
        viewRevision: 11,
        controlRevision: 9
      }
    });
    expect(runtimeSessionWithAcceptedProject(session, acceptedProject, null)).toMatchObject({
      snapshot: {
        sessionRevision: 7,
        viewRevision: 8
      }
    });
  });
});

function projectDocument(revision: string): ProjectDocumentV01 {
  return {
    schema: "skenion.project",
    schemaVersion: "0.1.0",
    id: "coverage-project",
    documentId: "77777777-7777-4777-8777-777777777777",
    revision,
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "root",
      revision,
      nodes: [],
      edges: []
    },
    viewState: {
      schema: "skenion.view-state",
      schemaVersion: "0.1.0",
      canvas: {
        nodes: {}
      }
    },
    patchLibrary: []
  };
}
