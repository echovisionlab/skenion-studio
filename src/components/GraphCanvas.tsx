import { useMemo } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  type NodeTypes,
} from "@xyflow/react";
import type { ViewStateV01 } from "@skenion/contracts";
import { ReactFlowNodeAdapter } from "./graph/ReactFlowNodeAdapter";
import type { RuntimeControlMessage, RuntimeControlValue } from "../runtime/types";
import type { DisplayGraphDocumentV01, DisplayGraphNodeV01 } from "../graph/patchLibrary";
import {
  type GraphPatch,
  type ConnectionCheck
} from "../graph/skenionGraph";
import { toReactFlowViewModel } from "../graph/reactFlowAdapter";
import { useGraphCanvasFlowState, type StudioFlowNode } from "./graph/useGraphCanvasFlowState";
import {
  GraphCanvasContextMenu,
} from "./graph/GraphCanvasContextMenu";
import { useGraphCanvasSelection, type GraphCanvasSelection } from "./graph/useGraphCanvasSelection";
import { useGraphCanvasInteractions } from "./graph/useGraphCanvasInteractions";
import { useLatestCallback } from "../hooks/useLatestCallback";
import type { CanvasViewport } from "../graph/viewport";

const nodeTypes: NodeTypes = {
  skenion: ReactFlowNodeAdapter
};

const emptyRuntimeControlPulses: Record<string, number> = {};
const emptyRuntimeControlValues: Record<string, RuntimeControlValue> = {};

interface GraphCanvasProps {
  graph: DisplayGraphDocumentV01;
  graphLocked?: boolean;
  editingObjectSpecNodeId?: string | null;
  viewState: ViewStateV01;
  viewport: CanvasViewport;
  selection: GraphCanvasSelection;
  onConnectionCheck: (check: ConnectionCheck | null) => void;
  onAddObjectAtPosition?: (position: { x: number; y: number }) => void;
  onGraphPointerPositionChange?: (position: { x: number; y: number } | null) => void;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void> | void;
  onObjectControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectLiveControl?: (nodeId: string, portId: string, message: RuntimeControlMessage) => void;
  onObjectParamChange?: (nodeId: string, key: string, value: unknown) => void;
  onObjectSpecEditComplete?: (nodeId: string) => void;
  onObjectSpecCommit?: (nodeId: string, text: string) => void;
  runtimeControlEnabled?: boolean;
  runtimeControlPulses?: Record<string, number>;
  runtimeControlValues?: Record<string, RuntimeControlValue>;
  onSelectionChange: (selection: GraphCanvasSelection) => void;
  onGraphChange: (graph: DisplayGraphDocumentV01, patches?: GraphPatch[]) => void;
  onViewStateChange: (viewState: ViewStateV01) => void;
  onViewportChange: (viewport: CanvasViewport) => void;
}

export function GraphCanvas({
  graph,
  graphLocked = true,
  editingObjectSpecNodeId = null,
  viewState,
  viewport,
  selection,
  onConnectionCheck,
  onAddObjectAtPosition,
  onGraphPointerPositionChange,
  onImportAsset,
  onObjectControl,
  onObjectLiveControl,
  onObjectParamChange,
  onObjectSpecEditComplete,
  onObjectSpecCommit,
  runtimeControlEnabled = false,
  runtimeControlPulses = emptyRuntimeControlPulses,
  runtimeControlValues = emptyRuntimeControlValues,
  onSelectionChange,
  onGraphChange,
  onViewStateChange,
  onViewportChange
}: GraphCanvasProps) {
  const selectedNodeIds = selection.nodeIds;
  const selectedEdgeIds = selection.edgeIds;
  const selectedEdgeId = selectedNodeIds.length > 0 ? null : selectedEdgeIds[0] ?? null;
  const nodeViewStateKey = JSON.stringify(viewState.canvas.nodes);
  const graphLayoutViewState = useMemo(
    () =>
      ({
        schema: "skenion.view-state",
        schemaVersion: "0.1.0",
        canvas: {
          nodes: JSON.parse(nodeViewStateKey) as ViewStateV01["canvas"]["nodes"]
        }
      }) satisfies ViewStateV01,
    [nodeViewStateKey]
  );
  const viewModel = useMemo(
    () => toReactFlowViewModel(graph, graphLayoutViewState),
    [graph, graphLayoutViewState]
  );
  const handleObjectControl = useLatestCallback(onObjectControl);
  const handleImportAsset = useLatestCallback(onImportAsset);
  const handleObjectParamChange = useLatestCallback(onObjectParamChange);
  const handleObjectLiveControl = useLatestCallback(onObjectLiveControl);
  const handleObjectSpecCommit = useLatestCallback(onObjectSpecCommit);
  const handleObjectSpecEditComplete = useLatestCallback(onObjectSpecEditComplete);
  const flowNodes = useMemo<StudioFlowNode[]>(
    () =>
      viewModel.nodes.map((node) => ({
          ...node,
        data: {
          ...node.data,
          onImportAsset: handleImportAsset,
          onObjectControl: handleObjectControl,
          onObjectLiveControl: handleObjectLiveControl,
          onObjectParamChange: handleObjectParamChange,
          onObjectSpecEditComplete: handleObjectSpecEditComplete,
          onObjectSpecCommit: handleObjectSpecCommit,
          editingObjectSpec: editingObjectSpecNodeId === node.id,
          layoutEditable: !graphLocked,
          runtimeControlEnabled,
          runtimeControlPulseKey: runtimeControlPulses[node.id] ?? 0,
          runtimeControlValue: runtimeControlValues[node.id],
        }
      })),
    [
      handleObjectControl,
      handleImportAsset,
      handleObjectLiveControl,
      handleObjectParamChange,
      handleObjectSpecEditComplete,
      handleObjectSpecCommit,
      editingObjectSpecNodeId,
      graphLocked,
      runtimeControlEnabled,
      runtimeControlPulses,
      runtimeControlValues,
      viewModel.nodes
    ]
  );
  const { edges, nodes, onEdgesChange, onNodesChange } = useGraphCanvasFlowState({
    edges: viewModel.edges,
    nodes: flowNodes,
    selectedEdgeIds,
    selectedNodeIds
  });
  const defaultEdgeOptions = useMemo(
    () => ({
      type: "smoothstep",
      interactionWidth: 18
    }),
    []
  );
  const deleteKeyCode = useMemo(() => (graphLocked ? null : ["Backspace", "Delete"]), [graphLocked]);
  const emitSelection = useGraphCanvasSelection({
    onSelectionChange,
    selection
  });
  const {
    activeConnectionMessage,
    contextMenu,
    contextMenuActions,
    reactFlowHandlers
  } = useGraphCanvasInteractions({
    edges,
    emitSelection,
    graph,
    graphLocked,
    onAddObjectAtPosition,
    onConnectionCheck,
    onGraphChange,
    onGraphPointerPositionChange,
    onViewStateChange,
    onViewportChange,
    selectedEdgeId,
    selectedNodeIds,
    viewState,
    viewport
  });

  return (
    <ReactFlow
      className="skenion-flow"
      defaultEdgeOptions={defaultEdgeOptions}
      defaultViewport={viewport}
      deleteKeyCode={deleteKeyCode}
      edges={edges}
      key={graph.id}
      nodeTypes={nodeTypes}
      nodes={nodes}
      nodesConnectable={!graphLocked}
      nodesDraggable={!graphLocked}
      isValidConnection={reactFlowHandlers.isValidConnection}
      onConnect={reactFlowHandlers.onConnect}
      onConnectEnd={reactFlowHandlers.onConnectEnd}
      onConnectStart={reactFlowHandlers.onConnectStart}
      onEdgesChange={onEdgesChange}
      onEdgesDelete={reactFlowHandlers.onEdgesDelete}
      onEdgeClick={reactFlowHandlers.handleEdgeClick}
      onEdgeContextMenu={reactFlowHandlers.handleEdgeContextMenu}
      onNodeClick={reactFlowHandlers.handleNodeClick}
      onNodeContextMenu={reactFlowHandlers.handleNodeContextMenu}
      onNodeDragStop={reactFlowHandlers.onNodeDragStop}
      onNodesChange={onNodesChange}
      onNodesDelete={reactFlowHandlers.onNodesDelete}
      onPaneClick={reactFlowHandlers.handlePaneClick}
      onPaneContextMenu={reactFlowHandlers.handlePaneContextMenu}
      onPaneMouseLeave={reactFlowHandlers.handlePaneMouseLeave}
      onPaneMouseMove={reactFlowHandlers.handlePaneMouseMove}
      onSelectionChange={reactFlowHandlers.handleSelectionChange}
      onMoveEnd={reactFlowHandlers.onMoveEnd}
    >
      <Background color="var(--sk-grid-dot)" gap={20} size={1} />
      {activeConnectionMessage ? (
        <Panel className="connection-status" position="top-center">
          {activeConnectionMessage}
        </Panel>
      ) : null}
      <GraphCanvasContextMenu
        layoutEditable={!graphLocked}
        menu={contextMenu}
        {...contextMenuActions}
      />
      <Controls position="bottom-left" showInteractive={false} />
    </ReactFlow>
  );
}
