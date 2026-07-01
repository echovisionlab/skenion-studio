import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange
} from "@xyflow/react";
import type { SkenionNodeData } from "../../graph/reactFlowAdapter";
import { runtimeControlValueEquals } from "../../runtime/controlMessage";

export type StudioFlowNode = Node<SkenionNodeData>;

export interface UseGraphCanvasFlowStateInput {
  edges: Edge[];
  nodes: StudioFlowNode[];
  selectedEdgeIds: string[];
  selectedNodeIds: string[];
}

export function useGraphCanvasFlowState({
  edges: nextEdges,
  nodes: nextNodes,
  selectedEdgeIds,
  selectedNodeIds
}: UseGraphCanvasFlowStateInput) {
  const [nodes, setNodes] = useState<StudioFlowNode[]>(() =>
    reconcileFlowNodes([], nextNodes, selectedNodeIds)
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    reconcileFlowEdges([], nextEdges, selectedEdgeIds)
  );
  const nodesRef = useRef(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    setNodes((currentNodes) => {
      return reconcileFlowNodes(currentNodes, nextNodes, selectedNodeIds);
    });
  }, [nextNodes, selectedNodeIds, setNodes]);

  useEffect(() => {
    setEdges((currentEdges) => {
      return reconcileFlowEdges(currentEdges, nextEdges, selectedEdgeIds);
    });
  }, [nextEdges, selectedEdgeIds, setEdges]);

  const onNodesChange = useCallback((changes: NodeChange<StudioFlowNode>[]) => {
    const ownedChanges = selectEffectiveNodeChanges(nodesRef.current, changes);
    if (!ownedChanges.length) {
      return;
    }

    setNodes((currentNodes) => {
      const changedNodes = applyNodeChanges(ownedChanges, currentNodes);
      return sameNodeArray(currentNodes, changedNodes) ? currentNodes : changedNodes;
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    const ownedChanges = changes.filter(isStudioOwnedEdgeChange);
    if (!ownedChanges.length) {
      return;
    }

    setEdges((currentEdges) => {
      const changedEdges = applyEdgeChanges(ownedChanges, currentEdges);
      return sameEdgeArray(currentEdges, changedEdges) ? currentEdges : changedEdges;
    });
  }, []);

  return {
    edges,
    nodes,
    onEdgesChange,
    onNodesChange
  };
}

function reconcileFlowNodes(
  currentNodes: StudioFlowNode[],
  nextNodes: StudioFlowNode[],
  selectedNodeIds: string[]
): StudioFlowNode[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  const selectedNodeIdSet = new Set(selectedNodeIds);
  let changed = currentNodes.length !== nextNodes.length;
  const reconciled = nextNodes.map((nextNode) => {
    const currentNode = currentById.get(nextNode.id);
    const selected = selectedNodeIdSet.has(nextNode.id);
    if (currentNode && sameFlowNode(currentNode, nextNode, selected)) {
      return currentNode;
    }
    changed = true;
    return currentNode ? mergeFlowNode(currentNode, nextNode, selected) : withSelection(nextNode, selected);
  });
  return changed ? reconciled : currentNodes;
}

function reconcileFlowEdges(currentEdges: Edge[], nextEdges: Edge[], selectedEdgeIds: string[]): Edge[] {
  const currentById = new Map(currentEdges.map((edge) => [edge.id, edge]));
  const selectedEdgeIdSet = new Set(selectedEdgeIds);
  let changed = currentEdges.length !== nextEdges.length;
  const reconciled = nextEdges.map((nextEdge) => {
    const currentEdge = currentById.get(nextEdge.id);
    const selected = selectedEdgeIdSet.has(nextEdge.id);
    if (currentEdge && sameFlowEdge(currentEdge, nextEdge, selected)) {
      return currentEdge;
    }
    changed = true;
    return withSelection(nextEdge, selected);
  });
  return changed ? reconciled : currentEdges;
}

function mergeFlowNode(currentNode: StudioFlowNode, nextNode: StudioFlowNode, selected: boolean): StudioFlowNode {
  return {
    ...currentNode,
    ...nextNode,
    selected,
    position: currentNode.dragging ? currentNode.position : nextNode.position,
    data: {
      ...currentNode.data,
      ...nextNode.data
    }
  };
}

function sameFlowNode(currentNode: StudioFlowNode, nextNode: StudioFlowNode, selected: boolean): boolean {
  const samePosition = Boolean(currentNode.dragging) ||
    (
      currentNode.position.x === nextNode.position.x &&
      currentNode.position.y === nextNode.position.y
    );

  return (
    currentNode.type === nextNode.type &&
    currentNode.dragHandle === nextNode.dragHandle &&
    Boolean(currentNode.selected) === selected &&
    samePosition &&
    currentNode.data.card === nextNode.data.card &&
    currentNode.data.node === nextNode.data.node &&
    currentNode.data.editingObjectSpec === nextNode.data.editingObjectSpec &&
    currentNode.data.layoutEditable === nextNode.data.layoutEditable &&
    currentNode.data.primaryFlow === nextNode.data.primaryFlow &&
    currentNode.data.runtimeControlEnabled === nextNode.data.runtimeControlEnabled &&
    currentNode.data.runtimeControlPulseKey === nextNode.data.runtimeControlPulseKey &&
    runtimeControlValueEquals(
      currentNode.data.runtimeControlValue,
      nextNode.data.runtimeControlValue
    )
  );
}

function sameFlowEdge(currentEdge: Edge, nextEdge: Edge, selected: boolean): boolean {
  return (
    currentEdge.source === nextEdge.source &&
    currentEdge.sourceHandle === nextEdge.sourceHandle &&
    currentEdge.target === nextEdge.target &&
    currentEdge.targetHandle === nextEdge.targetHandle &&
    Boolean(currentEdge.selected) === selected &&
    currentEdge.type === nextEdge.type &&
    currentEdge.label === nextEdge.label &&
    JSON.stringify(currentEdge.style ?? {}) === JSON.stringify(nextEdge.style ?? {}) &&
    JSON.stringify(currentEdge.markerStart ?? null) === JSON.stringify(nextEdge.markerStart ?? null) &&
    JSON.stringify(currentEdge.markerEnd ?? null) === JSON.stringify(nextEdge.markerEnd ?? null)
  );
}

function withSelection<T extends { selected?: boolean }>(item: T, selected: boolean): T {
  return Boolean(item.selected) === selected ? item : { ...item, selected };
}

function isStudioOwnedNodeChange(change: NodeChange<StudioFlowNode>): boolean {
  return change.type === "add" ||
    change.type === "remove" ||
    change.type === "replace" ||
    change.type === "position" ||
    change.type === "dimensions";
}

function isStudioOwnedEdgeChange(change: EdgeChange<Edge>): boolean {
  return change.type === "add" ||
    change.type === "remove" ||
    change.type === "replace";
}

function sameNodeArray(currentNodes: StudioFlowNode[], nextNodes: StudioFlowNode[]): boolean {
  return currentNodes.length === nextNodes.length &&
    currentNodes.every((node, index) => node === nextNodes[index]);
}

function sameEdgeArray(currentEdges: Edge[], nextEdges: Edge[]): boolean {
  return currentEdges.length === nextEdges.length &&
    currentEdges.every((edge, index) => edge === nextEdges[index]);
}

function selectEffectiveNodeChanges(
  currentNodes: StudioFlowNode[],
  changes: NodeChange<StudioFlowNode>[]
): NodeChange<StudioFlowNode>[] {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  return changes.filter((change) => {
    if (!isStudioOwnedNodeChange(change)) {
      return false;
    }
    if (change.type === "add" || change.type === "remove" || change.type === "replace") {
      return true;
    }

    const currentNode = currentById.get(change.id);
    if (!currentNode) {
      return true;
    }

    if (change.type === "position") {
      const samePosition = !change.position ||
        (
          currentNode.position.x === change.position.x &&
          currentNode.position.y === change.position.y
        );
      const sameDragging = typeof change.dragging === "undefined" || currentNode.dragging === change.dragging;
      return !(samePosition && sameDragging);
    }
    if (change.type !== "dimensions") {
      return false;
    }

    const sameMeasured = !change.dimensions ||
      (
        currentNode.measured?.width === change.dimensions.width &&
        currentNode.measured?.height === change.dimensions.height
      );
    const sameWidth = !change.setAttributes ||
      change.setAttributes === "height" ||
      currentNode.width === change.dimensions?.width;
    const sameHeight = !change.setAttributes ||
      change.setAttributes === "width" ||
      currentNode.height === change.dimensions?.height;
    const sameResizing = typeof change.resizing === "undefined" || currentNode.resizing === change.resizing;

    return !(sameMeasured && sameWidth && sameHeight && sameResizing);
  });
}
