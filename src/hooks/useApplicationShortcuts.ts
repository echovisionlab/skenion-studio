import { useEffect } from "react";
import {
  applicationShortcutAction,
  type ApplicationShortcutAction
} from "../shortcuts/applicationShortcuts";
import { useLatestRef } from "./useLatestCallback";

export interface GraphPointerPosition {
  x: number;
  y: number;
}

export interface UseApplicationShortcutsInput {
  enabled: boolean;
  getGraphPointerPosition: () => GraphPointerPosition | null;
  onCreateObjectAtPosition: (request: {
    beginEditingObjectSpec: boolean;
    objectSpec?: string;
    position: GraphPointerPosition;
  }) => void;
  onToggleGraphLock: () => void;
}

export function useApplicationShortcuts(input: UseApplicationShortcutsInput) {
  const inputRef = useLatestRef(input);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = inputRef.current;
      if (!current.enabled) {
        return;
      }
      const pointerPosition = current.getGraphPointerPosition();
      const action = applicationShortcutAction(event, {
        graphPointerActive: Boolean(pointerPosition),
        selectedText: window.getSelection()?.toString() ?? ""
      });
      if (!action) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      runApplicationShortcut(action, pointerPosition, current);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [inputRef]);
}

function runApplicationShortcut(
  action: ApplicationShortcutAction,
  pointerPosition: GraphPointerPosition | null,
  input: UseApplicationShortcutsInput
) {
  if (action.kind === "toggleGraphLock") {
    input.onToggleGraphLock();
    return;
  }
  if (!pointerPosition) {
    return;
  }
  input.onCreateObjectAtPosition({
    beginEditingObjectSpec: action.beginEditingObjectSpec,
    objectSpec: action.objectSpec,
    position: pointerPosition
  });
}
