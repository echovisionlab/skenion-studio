import { useCallback, useEffect, useRef } from "react";

export interface GraphCanvasSelection {
  edgeIds: string[];
  nodeIds: string[];
}

export interface GraphCanvasSelectionInput {
  onSelectionChange: (selection: GraphCanvasSelection) => void;
  selection: GraphCanvasSelection;
}

export function useGraphCanvasSelection({
  onSelectionChange,
  selection
}: GraphCanvasSelectionInput) {
  const emittedSelectionRef = useRef(selection);

  useEffect(() => {
    emittedSelectionRef.current = selection;
  }, [selection]);

  return useCallback(
    (nodeIds: string[], edgeIds: string[]) => {
      const currentSelection = emittedSelectionRef.current;
      if (
        stringArraysEqual(currentSelection.nodeIds, nodeIds) &&
        stringArraysEqual(currentSelection.edgeIds, edgeIds)
      ) {
        return;
      }

      emittedSelectionRef.current = { edgeIds, nodeIds };
      onSelectionChange({ edgeIds, nodeIds });
    },
    [onSelectionChange]
  );
}

function stringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
