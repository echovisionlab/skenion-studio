import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { updateWindowLocalState, type StudioWindowRegistry } from "../desktop/windowRegistry";

export interface StudioSelectionState {
  selectedEdgeId: string | null;
  selectedEdgeIds: string[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
}

export interface StudioSelectionIds {
  edgeIds: string[];
  nodeIds: string[];
}

export interface StudioSelectionController extends StudioSelectionState {
  handleCanvasSelectionChange: (selection: StudioSelectionIds) => void;
  pruneSelection: (availableNodeIds: Set<string>, availableEdgeIds: Set<string>) => StudioSelectionState;
  selectSingleNode: (nodeId: string | null) => void;
}

interface UseStudioSelectionOptions {
  openInspector: () => void;
  setWindowRegistry: Dispatch<SetStateAction<StudioWindowRegistry>>;
  studioWindowId: string;
}

export function useStudioSelection({
  openInspector,
  setWindowRegistry,
  studioWindowId
}: UseStudioSelectionOptions): StudioSelectionController {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const selectedNodeIdsRef = useRef(selectedNodeIds);
  const selectedEdgeIdsRef = useRef(selectedEdgeIds);

  const commitSelection = useCallback(
    (nextNodeIds: string[], nextEdgeIds: string[]): StudioSelectionState => {
      const nodeIds = [...nextNodeIds];
      const edgeIds = [...nextEdgeIds];
      const nodesChanged = !stringArraysEqual(selectedNodeIdsRef.current, nodeIds);
      const edgesChanged = !stringArraysEqual(selectedEdgeIdsRef.current, edgeIds);

      if (nodesChanged) {
        selectedNodeIdsRef.current = nodeIds;
        setSelectedNodeIds(nodeIds);
      }
      if (edgesChanged) {
        selectedEdgeIdsRef.current = edgeIds;
        setSelectedEdgeIds(edgeIds);
      }
      if (nodesChanged || edgesChanged) {
        setWindowRegistry((current) =>
          updateWindowLocalState(current, studioWindowId, {
            selectedEdgeIds: edgeIds,
            selectedNodeIds: nodeIds
          })
        );
      }

      return selectionStateFromIds(nodeIds, edgeIds);
    },
    [setWindowRegistry, studioWindowId]
  );

  const selectSingleNode = useCallback(
    (nodeId: string | null) => {
      commitSelection(nodeId ? [nodeId] : [], []);
    },
    [commitSelection]
  );

  const pruneSelection = useCallback(
    (availableNodeIds: Set<string>, availableEdgeIds: Set<string>): StudioSelectionState => {
      const nodeIds = selectedNodeIdsRef.current.filter((nodeId) => availableNodeIds.has(nodeId));
      const edgeIds = selectedEdgeIdsRef.current.filter((edgeId) => availableEdgeIds.has(edgeId));
      return commitSelection(nodeIds, edgeIds);
    },
    [commitSelection]
  );

  const handleCanvasSelectionChange = useCallback(
    ({ edgeIds, nodeIds }: StudioSelectionIds) => {
      commitSelection(nodeIds, edgeIds);
      if (nodeIds.length > 0 || edgeIds.length > 0) {
        openInspector();
      }
    },
    [commitSelection, openInspector]
  );

  return {
    handleCanvasSelectionChange,
    pruneSelection,
    selectSingleNode,
    selectedEdgeId: selectedNodeIds.length > 0 ? null : selectedEdgeIds[0] ?? null,
    selectedEdgeIds,
    selectedNodeId: selectedNodeIds[0] ?? null,
    selectedNodeIds
  };
}

function selectionStateFromIds(nodeIds: string[], edgeIds: string[]): StudioSelectionState {
  return {
    selectedEdgeId: nodeIds.length > 0 ? null : edgeIds[0] ?? null,
    selectedEdgeIds: edgeIds,
    selectedNodeId: nodeIds[0] ?? null,
    selectedNodeIds: nodeIds
  };
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}
