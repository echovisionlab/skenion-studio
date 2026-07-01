import { hasPrimaryModifier, isEditableShortcutTarget } from "../shortcuts/keyboard";
export { isEditableShortcutTarget } from "../shortcuts/keyboard";

export type RuntimeHistoryShortcutAction = "undo" | "redo";

export interface RuntimeHistoryShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

export function runtimeHistoryShortcutAction(
  event: RuntimeHistoryShortcutEvent
): RuntimeHistoryShortcutAction | null {
  if (isEditableShortcutTarget(event.target) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (!hasPrimaryModifier(event)) {
    return null;
  }

  if (key === "z" && event.shiftKey) {
    return "redo";
  }
  if (key === "z") {
    return "undo";
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.shiftKey) {
    return "redo";
  }

  return null;
}
