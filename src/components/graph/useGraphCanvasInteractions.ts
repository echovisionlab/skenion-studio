import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type {
  Connection,
  Edge,
  EdgeMouseHandler,
  NodeMouseHandler,
  OnConnectEnd,
  OnConnectStart,
  OnSelectionChangeFunc,
  Viewport
} from "@xyflow/react";
import type { ViewStateV01 } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../../graph/patchLibrary";
import {
  applyPatch,
  checkConnection,
  isValidSkenionConnection,
  toSkenionPatch,
  type ConnectionCheck,
  type GraphPatch
} from "../../graph/skenionGraph";
import {
  updateViewStateNodePosition,
  updateViewStateViewport
} from "../../graph/projectDocument";
import type { StudioFlowNode } from "./useGraphCanvasFlowState";
import type { GraphCanvasContextMenuState } from "./GraphCanvasContextMenu";
import {
  connectionFromFinalState,
  connectionStartMessage,
  duplicateGraphNode,
  removeGraphEdgeById,
  removeGraphEdges,
  removeGraphNodes
} from "./graphCanvasActions";

export interface UseGraphCanvasInteractionsInput {
  edges: Edge[];
  emitSelection: (nodeIds: string[], edgeIds: string[]) => void;
  graph: DisplayGraphDocumentV01;
  graphLocked: boolean;
  onAddObjectAtPosition?: (position: { x: number; y: number }) => void;
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onGraphChange: (graph: DisplayGraphDocumentV01, patches?: GraphPatch[]) => void;
  onViewStateChange: (viewState: ViewStateV01) => void;
  selectedEdgeId: string | null;
  selectedNodeIds: string[];
  viewState: ViewStateV01;
  viewport: Viewport;
}

export function useGraphCanvasInteractions({
  edges,
  emitSelection,
  graph,
  graphLocked,
  onAddObjectAtPosition,
  onConnectionCheck,
  onGraphChange,
  onViewStateChange,
  selectedEdgeId,
  selectedNodeIds,
  viewState,
  viewport
}: UseGraphCanvasInteractionsInput) {
  const deletingNodeIdsRef = useRef<Set<string>>(new Set());
  const activeConnectionRef = useRef<string | null>(null);
  const [activeConnectionMessage, setActiveConnectionMessage] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<GraphCanvasContextMenuState | null>(null);

  const onConnect = useCallback(
    (connection: Connection) => {
      activeConnectionRef.current = null;
      setActiveConnectionMessage(null);
      if (graphLocked) {
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before creating cables."
        });
        return;
      }
      const patch = toSkenionPatch(connection);
      const check = checkConnection(graph, patch);
      onConnectionCheck(check);
      if (!check.ok || !patch) {
        return;
      }

      onGraphChange(applyPatch(graph, patch), [patch]);
    },
    [graph, graphLocked, onConnectionCheck, onGraphChange]
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      !graphLocked &&
      isValidSkenionConnection(graph, {
        source: connection.source,
        sourceHandle: connection.sourceHandle ?? null,
        target: connection.target,
        targetHandle: connection.targetHandle ?? null
      }),
    [graph, graphLocked]
  );

  const onConnectStart = useCallback<OnConnectStart>(
    (_event, params) => {
      if (graphLocked) {
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before creating cables."
        });
        return;
      }
      const message = connectionStartMessage(graph, params.nodeId, params.handleId);
      activeConnectionRef.current = message;
      setActiveConnectionMessage(message);
      if (message) {
        onConnectionCheck({
          ok: true,
          message
        });
      }
    },
    [graph, graphLocked, onConnectionCheck]
  );

  const onConnectEnd = useCallback<OnConnectEnd>(
    (_event, connectionState) => {
      if (graphLocked) {
        activeConnectionRef.current = null;
        setActiveConnectionMessage(null);
        return;
      }
      window.setTimeout(() => {
        if (!activeConnectionRef.current) {
          return;
        }
        const attemptedConnection = connectionFromFinalState(connectionState);
        if (attemptedConnection) {
          onConnectionCheck(checkConnection(graph, toSkenionPatch(attemptedConnection)));
          activeConnectionRef.current = null;
          setActiveConnectionMessage(null);
          return;
        }
        onConnectionCheck({
          ok: false,
          message: `Connection rejected before drop. ${activeConnectionRef.current}`
        });
        activeConnectionRef.current = null;
        setActiveConnectionMessage(null);
      }, 0);
    },
    [graph, graphLocked, onConnectionCheck]
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | TouchEvent, node: StudioFlowNode) => {
      if (graphLocked) {
        return;
      }
      onViewStateChange(updateViewStateNodePosition(graph, viewState, node.id, node.position));
    },
    [graph, graphLocked, onViewStateChange, viewState]
  );

  const onMoveEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, nextViewport: Viewport) => {
      onViewStateChange(updateViewStateViewport(graph, viewState, nextViewport));
    },
    [graph, onViewStateChange, viewState]
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      if (graphLocked) {
        return;
      }
      const result = removeGraphEdges(graph, deletedEdges, deletingNodeIdsRef.current);
      onGraphChange(result.graph, result.patches);
      if (deletedEdges.some((edge) => edge.id === selectedEdgeId)) {
        emitSelection(selectedNodeIds, []);
      }
      onConnectionCheck(null);
    },
    [emitSelection, graph, graphLocked, onConnectionCheck, onGraphChange, selectedEdgeId, selectedNodeIds]
  );

  const onNodesDelete = useCallback(
    (deletedNodes: StudioFlowNode[]) => {
      if (graphLocked) {
        return;
      }
      deletingNodeIdsRef.current = new Set(deletedNodes.map((node) => node.id));
      window.queueMicrotask(() => {
        deletingNodeIdsRef.current = new Set();
      });
      const result = removeGraphNodes(graph, deletedNodes);
      onGraphChange(result.graph, result.patches);
      emitSelection([], []);
    },
    [emitSelection, graph, graphLocked, onGraphChange]
  );

  const addObjectAtMenuPosition = useCallback(
    () => {
      if (!contextMenu || contextMenu.type !== "pane") {
        return;
      }
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before adding objects."
        });
        return;
      }
      onAddObjectAtPosition?.(contextMenu.flowPosition);
      setContextMenu(null);
    },
    [contextMenu, graphLocked, onAddObjectAtPosition, onConnectionCheck]
  );

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before deleting objects."
        });
        return;
      }
      const result = removeGraphNodes(graph, [{ id: nodeId }]);
      onGraphChange(result.graph, result.patches);
      emitSelection([], []);
      setContextMenu(null);
    },
    [emitSelection, graph, graphLocked, onConnectionCheck, onGraphChange]
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before deleting cables."
        });
        return;
      }
      const result = removeGraphEdgeById(graph, edges, edgeId);
      if (!result) {
        return;
      }
      onGraphChange(result.graph, result.patches);
      emitSelection(selectedNodeIds, []);
      setContextMenu(null);
    },
    [edges, emitSelection, graph, graphLocked, onConnectionCheck, onGraphChange, selectedNodeIds]
  );

  const duplicateNodeById = useCallback(
    (nodeId: string) => {
      if (graphLocked) {
        setContextMenu(null);
        onConnectionCheck({
          ok: false,
          message: "Unlock the graph before duplicating objects."
        });
        return;
      }
      const result = duplicateGraphNode(graph, viewState, nodeId);
      if (!result) {
        return;
      }
      onGraphChange(result.graph, result.patches);
      onViewStateChange(result.viewState);
      emitSelection([result.nodeId], []);
      setContextMenu(null);
    },
    [emitSelection, graph, graphLocked, onConnectionCheck, onGraphChange, onViewStateChange, viewState]
  );

  const handleEdgeClick = useCallback<EdgeMouseHandler>(
    (_event, edge) => {
      emitSelection([], [edge.id]);
    },
    [emitSelection]
  );

  const handleEdgeContextMenu = useCallback<EdgeMouseHandler>(
    (event, edge) => {
      event.preventDefault();
      event.stopPropagation();
      emitSelection([], [edge.id]);
      setContextMenu({
        type: "edge",
        edgeId: edge.id,
        screenX: event.clientX,
        screenY: event.clientY
      });
    },
    [emitSelection]
  );

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      emitSelection([node.id], []);
    },
    [emitSelection]
  );

  const handleNodeContextMenu = useCallback<NodeMouseHandler>(
    (event, node) => {
      event.preventDefault();
      event.stopPropagation();
      emitSelection([node.id], []);
      setContextMenu({
        type: "node",
        nodeId: node.id,
        nodeKind: String(node.data.kind),
        screenX: event.clientX,
        screenY: event.clientY
      });
    },
    [emitSelection]
  );

  const handlePaneClick = useCallback(() => {
    emitSelection([], []);
    setContextMenu(null);
  }, [emitSelection]);

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | ReactMouseEvent<Element>) => {
      event.preventDefault();
      if (graphLocked) {
        setContextMenu({
          type: "pane",
          flowPosition: { x: 0, y: 0 },
          screenX: event.clientX,
          screenY: event.clientY
        });
        return;
      }
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setContextMenu({
        type: "pane",
        flowPosition: {
          x: (event.clientX - bounds.left - viewport.x) / viewport.zoom,
          y: (event.clientY - bounds.top - viewport.y) / viewport.zoom
        },
        screenX: event.clientX,
        screenY: event.clientY
      });
    },
    [graphLocked, viewport.x, viewport.y, viewport.zoom]
  );

  const handleSelectionChange = useCallback<OnSelectionChangeFunc<StudioFlowNode, Edge>>(
    ({ nodes: nextSelectedNodes, edges: nextSelectedEdges }) => {
      const nextNodeIds = nextSelectedNodes.map((node) => node.id);
      const nextEdgeIds = nextSelectedEdges.map((edge) => edge.id);
      emitSelection(nextNodeIds, nextEdgeIds);
    },
    [emitSelection]
  );

  const copyContextMenuText = useCallback((text: string) => {
    void navigator.clipboard?.writeText(text);
    setContextMenu(null);
  }, []);

  const inspectContextMenuEdge = useCallback(
    (edgeId: string) => {
      emitSelection([], [edgeId]);
      setContextMenu(null);
    },
    [emitSelection]
  );

  const inspectContextMenuNode = useCallback(
    (nodeId: string) => {
      emitSelection([nodeId], []);
      setContextMenu(null);
    },
    [emitSelection]
  );

  return {
    activeConnectionMessage,
    contextMenu,
    contextMenuActions: {
      onAddObject: addObjectAtMenuPosition,
      onClose: () => setContextMenu(null),
      onCopy: copyContextMenuText,
      onDeleteEdge: deleteEdgeById,
      onDeleteNode: deleteNodeById,
      onDuplicateNode: duplicateNodeById,
      onInspectEdge: inspectContextMenuEdge,
      onInspectNode: inspectContextMenuNode
    },
    reactFlowHandlers: {
      handleEdgeClick,
      handleEdgeContextMenu,
      handleNodeClick,
      handleNodeContextMenu,
      handlePaneClick,
      handlePaneContextMenu,
      handleSelectionChange,
      isValidConnection,
      onConnect,
      onConnectEnd,
      onConnectStart,
      onEdgesDelete,
      onMoveEnd,
      onNodeDragStop,
      onNodesDelete
    }
  };
}
