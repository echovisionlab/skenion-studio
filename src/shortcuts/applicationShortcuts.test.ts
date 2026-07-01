// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { applicationShortcutAction } from "./applicationShortcuts";

describe("application shortcuts", () => {
  it("maps Mod+E to graph lock toggle", () => {
    expect(applicationShortcutAction(event({ key: "e", metaKey: true }), inactiveGraph())).toEqual({
      kind: "toggleGraphLock"
    });
    expect(applicationShortcutAction(event({ key: "e", ctrlKey: true }), inactiveGraph())).toEqual({
      kind: "toggleGraphLock"
    });
  });

  it("maps graph-hover object creation keys", () => {
    expect(applicationShortcutAction(event({ key: "n" }), activeGraph())).toEqual({
      beginEditingObjectSpec: true,
      kind: "createObject"
    });
    expect(applicationShortcutAction(event({ key: "i" }), activeGraph())).toEqual({
      beginEditingObjectSpec: false,
      kind: "createObject",
      objectSpec: "int"
    });
    expect(applicationShortcutAction(event({ key: "f" }), activeGraph())).toEqual({
      beginEditingObjectSpec: false,
      kind: "createObject",
      objectSpec: "float"
    });
    expect(applicationShortcutAction(event({ key: "c" }), activeGraph())).toEqual({
      beginEditingObjectSpec: false,
      kind: "createObject",
      objectSpec: "comment"
    });
    expect(applicationShortcutAction(event({ key: "b" }), activeGraph())).toEqual({
      beginEditingObjectSpec: false,
      kind: "createObject",
      objectSpec: "bang"
    });
  });

  it("does not create graph nodes outside the graph or from text editing contexts", () => {
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.contentEditable = "true";

    expect(applicationShortcutAction(event({ key: "n" }), inactiveGraph())).toBeNull();
    expect(applicationShortcutAction(event({ key: "i", target: input }), activeGraph())).toBeNull();
    expect(applicationShortcutAction(event({ key: "f", target: editable }), activeGraph())).toBeNull();
    expect(applicationShortcutAction(event({ key: "b", repeat: true }), activeGraph())).toBeNull();
    expect(applicationShortcutAction(event({ key: "c" }), { ...activeGraph(), selectedText: "selected" })).toBeNull();
    expect(applicationShortcutAction(event({ key: "i", metaKey: true }), activeGraph())).toBeNull();
  });

  it("does not map inlet or outlet to app shortcuts", () => {
    expect(applicationShortcutAction(event({ key: "l" }), activeGraph())).toBeNull();
    expect(applicationShortcutAction(event({ key: "o" }), activeGraph())).toBeNull();
  });
});

function activeGraph() {
  return { graphPointerActive: true };
}

function inactiveGraph() {
  return { graphPointerActive: false };
}

function event(options: Partial<{
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  repeat: boolean;
  shiftKey: boolean;
  target: EventTarget | null;
}> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key: "n",
    metaKey: false,
    repeat: false,
    shiftKey: false,
    target: null,
    ...options
  };
}
