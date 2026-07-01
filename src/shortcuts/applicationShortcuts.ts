import {
  hasPrimaryModifier,
  hasSelectedText,
  isEditableShortcutTarget,
  type KeyboardShortcutEvent
} from "./keyboard";

export type ApplicationShortcutAction =
  | { kind: "toggleGraphLock" }
  | {
      beginEditingObjectSpec: boolean;
      kind: "createObject";
      objectSpec?: string;
    };

export interface ApplicationShortcutContext {
  graphPointerActive: boolean;
  selectedText?: string | null;
}

const DIRECT_OBJECT_SPECS: Record<string, string> = {
  b: "bang",
  c: "comment",
  f: "float",
  i: "int"
};

export function applicationShortcutAction(
  event: KeyboardShortcutEvent,
  context: ApplicationShortcutContext
): ApplicationShortcutAction | null {
  if (event.repeat || event.altKey || event.shiftKey || isEditableShortcutTarget(event.target) || hasSelectedText(context.selectedText)) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (hasPrimaryModifier(event)) {
    return key === "e" ? { kind: "toggleGraphLock" } : null;
  }

  if (!context.graphPointerActive) {
    return null;
  }
  if (key === "n") {
    return {
      beginEditingObjectSpec: true,
      kind: "createObject"
    };
  }
  const objectSpec = DIRECT_OBJECT_SPECS[key];
  return objectSpec ? {
    beginEditingObjectSpec: false,
    kind: "createObject",
    objectSpec
  } : null;
}
