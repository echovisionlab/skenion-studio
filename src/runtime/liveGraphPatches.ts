import type {
  EdgeSpecV01,
  GraphNodeV01,
  GraphTargetRef,
  ProjectDocumentV01
} from "@skenion/contracts";
import {
  displayEdgeToEdgeSpec,
  displayNodeToContractNode
} from "../graph/patchLibrary";
import type { GraphPatch } from "../graph/skenionGraph";
import type { RuntimeGraphCommandPayload, RuntimeGraphCommandResponse } from "./graphCommand";
import type { RuntimeSessionResponse } from "./types";

export type RuntimePatchCommandGroup =
  | { kind: "changeSet"; changes: RuntimeChangeSetChange[] }
  | { kind: "nodeUpdate"; nodeId: string; params: Record<string, unknown> };

export type RuntimeChangeSetChange =
  | { op: "node.add"; changeId: string; node: GraphNodeV01 }
  | { op: "node.delete"; changeId: string; nodeId: string }
  | { op: "edge.connect"; changeId: string; edge: EdgeSpecV01 }
  | { op: "edge.disconnect"; changeId: string; edgeId: string };

export function rootGraphTarget(baseRevision: string): GraphTargetRef {
  return {
    path: { kind: "root" },
    baseRevision
  };
}

export function runtimeCommandGroupsFromGraphPatches(patches: GraphPatch[]): RuntimePatchCommandGroup[] | null {
  const groups: RuntimePatchCommandGroup[] = [];
  let current: RuntimePatchCommandGroup | null = null;

  const pushCurrent = () => {
    if (current) {
      groups.push(current);
      current = null;
    }
  };

  for (const [index, patch] of patches.entries()) {
    if (patch.type === "setNodeParam") {
      if (current?.kind !== "nodeUpdate" || current.nodeId !== patch.nodeId) {
        pushCurrent();
        current = { kind: "nodeUpdate", nodeId: patch.nodeId, params: {} };
      }
      current.params[patch.key] = patch.value;
      continue;
    }

    const change = runtimeChangeSetChangeFromGraphPatch(patch, index);
    if (!change) {
      return null;
    }
    if (current?.kind !== "changeSet") {
      pushCurrent();
      current = { kind: "changeSet", changes: [] };
    }
    current.changes.push(change);
  }

  pushCurrent();
  return groups.filter((group) => group.kind !== "changeSet" || group.changes.length > 0);
}

export function runtimeGraphCommandPayloadForPatchGroup(
  group: RuntimePatchCommandGroup,
  baseRevision: string,
  baseSessionRevision?: number
): RuntimeGraphCommandPayload {
  const target = rootGraphTarget(baseRevision);
  const base = {
    baseGraphRevision: baseRevision,
    ...(typeof baseSessionRevision === "number" ? { baseSessionRevision } : {}),
    target
  };

  if (group.kind === "changeSet") {
    return {
      ...base,
      kind: "graph.changeSet",
      surfacePath: { surface: "graph", path: { kind: "root" } },
      changes: group.changes
    };
  }

  return {
    ...base,
    kind: "node.update",
    surfacePath: { surface: "graph", path: { kind: "root" }, nodeId: group.nodeId },
    nodeId: group.nodeId,
    params: group.params
  };
}

export function withProjectGraphRevision(project: ProjectDocumentV01, graphRevision: string): ProjectDocumentV01 {
  if (project.graph.revision === graphRevision && project.revision === graphRevision) {
    return project;
  }
  return {
    ...project,
    revision: graphRevision,
    graph: {
      ...project.graph,
      revision: graphRevision
    }
  };
}

export function runtimeSessionWithAcceptedProject(
  session: RuntimeSessionResponse | null,
  project: ProjectDocumentV01,
  response: RuntimeGraphCommandResponse | null
): RuntimeSessionResponse | null {
  if (!session) {
    return session;
  }
  return {
    ...session,
    snapshot: {
      ...session.snapshot,
      project,
      sessionRevision: response?.payload.sessionRevision ?? session.snapshot.sessionRevision,
      viewRevision: response?.payload.viewRevision ?? session.snapshot.viewRevision
    }
  };
}

function runtimeChangeSetChangeFromGraphPatch(
  patch: GraphPatch,
  index: number
): RuntimeChangeSetChange | null {
  if (patch.type === "addNode") {
    return {
      op: "node.add",
      changeId: graphPatchChangeId("add-node", index, patch.node.id),
      node: displayNodeToContractNode(patch.node)
    };
  }
  if (patch.type === "removeNode") {
    return {
      op: "node.delete",
      changeId: graphPatchChangeId("delete-node", index, patch.nodeId),
      nodeId: patch.nodeId
    };
  }
  if (patch.type === "addEdge") {
    const edge = displayEdgeToEdgeSpec(patch.edge);
    return {
      op: "edge.connect",
      changeId: graphPatchChangeId("connect-edge", index, edge.id),
      edge
    };
  }
  if (patch.type === "removeEdge") {
    const edge = displayEdgeToEdgeSpec(patch.edge);
    return {
      op: "edge.disconnect",
      changeId: graphPatchChangeId("disconnect-edge", index, edge.id),
      edgeId: edge.id
    };
  }

  return null;
}

function graphPatchChangeId(prefix: string, index: number, id: string): string {
  return `${prefix}-${index}-${id.replace(/[^A-Za-z0-9_.:-]+/gu, "-")}`;
}
