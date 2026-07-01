import type { Connection, Edge, FinalConnectionState } from "@xyflow/react";
import type { ViewStateV01 } from "@skenion/contracts";
import type {
  DisplayGraphDocumentV01,
  DisplayGraphNodeV01
} from "../../graph/patchLibrary";
import {
  applyPatch,
  edgeFromReactFlow,
  type GraphPatch
} from "../../graph/skenionGraph";
import { portSemanticsForPort } from "../../graph/portSemantics";

export interface GraphPatchResult {
  graph: DisplayGraphDocumentV01;
  patches: GraphPatch[];
}

export interface DuplicateGraphNodeResult extends GraphPatchResult {
  nodeId: string;
  viewState: ViewStateV01;
}

export function removeGraphEdges(
  graph: DisplayGraphDocumentV01,
  edges: Edge[],
  skippedNodeIds: Set<string>
): GraphPatchResult {
  let nextGraph = graph;
  const patches: GraphPatch[] = [];

  for (const edge of edges) {
    if (skippedNodeIds.has(edge.source) || skippedNodeIds.has(edge.target)) {
      continue;
    }
    const skenionEdge = edgeFromReactFlow(edge);
    if (!skenionEdge) {
      continue;
    }
    const patch = { type: "removeEdge", edge: skenionEdge } satisfies GraphPatch;
    nextGraph = applyPatch(nextGraph, patch);
    patches.push(patch);
  }

  return { graph: nextGraph, patches };
}

export function removeGraphNodes(
  graph: DisplayGraphDocumentV01,
  nodes: Pick<DisplayGraphNodeV01, "id">[]
): GraphPatchResult {
  let nextGraph = graph;
  const patches: GraphPatch[] = [];

  for (const node of nodes) {
    const patch = { type: "removeNode", nodeId: node.id } satisfies GraphPatch;
    nextGraph = applyPatch(nextGraph, patch);
    patches.push(patch);
  }

  return { graph: nextGraph, patches };
}

export function removeGraphEdgeById(
  graph: DisplayGraphDocumentV01,
  edges: Edge[],
  edgeId: string
): GraphPatchResult | null {
  const edge = edges.find((candidate) => candidate.id === edgeId);
  const skenionEdge = edge ? edgeFromReactFlow(edge) : null;
  if (!skenionEdge) {
    return null;
  }

  const patch = { type: "removeEdge", edge: skenionEdge } satisfies GraphPatch;
  return {
    graph: applyPatch(graph, patch),
    patches: [patch]
  };
}

export function duplicateGraphNode(
  graph: DisplayGraphDocumentV01,
  viewState: ViewStateV01,
  nodeId: string
): DuplicateGraphNodeResult | null {
  const source = graph.nodes.find((node) => node.id === nodeId);
  const viewNode = viewState.canvas.nodes[nodeId];
  if (!source) {
    return null;
  }

  const nextId = nextDuplicateNodeId(source.id, graph.nodes.map((node) => node.id));
  const node = {
    ...JSON.parse(JSON.stringify(source)),
    id: nextId
  } as typeof source;
  const patch = { type: "addNode", node } satisfies GraphPatch;

  return {
    graph: applyPatch(graph, patch),
    nodeId: nextId,
    patches: [patch],
    viewState: reconcileViewStateAfterDuplicate(viewState, nextId, viewNode ?? { x: 120, y: 120 })
  };
}

export function connectionFromFinalState(connectionState: FinalConnectionState): Connection | null {
  if (!connectionState.fromHandle || !connectionState.toHandle) {
    return null;
  }

  const { fromHandle, toHandle } = connectionState;
  if (fromHandle.type === "source" && toHandle.type === "target") {
    return {
      source: fromHandle.nodeId,
      sourceHandle: fromHandle.id ?? null,
      target: toHandle.nodeId,
      targetHandle: toHandle.id ?? null
    };
  }

  if (fromHandle.type === "target" && toHandle.type === "source") {
    return {
      source: toHandle.nodeId,
      sourceHandle: toHandle.id ?? null,
      target: fromHandle.nodeId,
      targetHandle: fromHandle.id ?? null
    };
  }

  return null;
}

export function connectionStartMessage(
  graph: DisplayGraphDocumentV01,
  nodeId: string | null,
  portId: string | null
): string | null {
  if (!nodeId || !portId) {
    return null;
  }

  const node = graph.nodes.find((candidate) => candidate.id === nodeId);
  const port = node?.ports.find((candidate) => candidate.id === portId);
  if (!node || !port) {
    return null;
  }

  const semantics = portSemanticsForPort(node, port);
  const side = port.direction === "output" ? "OUT" : "IN";
  return `Dragging ${side}: ${node.id}.${port.id} ${semantics.type}`;
}

function nextDuplicateNodeId(baseId: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  let index = 2;
  let id = `${baseId}_${index}`;
  while (used.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }
  return id;
}

function reconcileViewStateAfterDuplicate(
  viewState: ViewStateV01,
  nodeId: string,
  sourcePosition: { x: number; y: number }
): ViewStateV01 {
  return {
    ...viewState,
    canvas: {
      ...viewState.canvas,
      nodes: {
        ...viewState.canvas.nodes,
        [nodeId]: {
          x: sourcePosition.x + 32,
          y: sourcePosition.y + 32
        }
      }
    }
  };
}
