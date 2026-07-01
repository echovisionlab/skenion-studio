export interface KeyboardShortcutEvent {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}

export function hasPrimaryModifier(event: KeyboardShortcutEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

export function hasSelectedText(selectedText: string | null | undefined): boolean {
  return typeof selectedText === "string" && selectedText.length > 0;
}

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "select" || tagName === "textarea";
}
