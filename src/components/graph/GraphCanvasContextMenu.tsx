import { useReactFlow } from "@xyflow/react";

export type GraphCanvasContextMenuState =
  | {
      type: "node";
      nodeId: string;
      nodeKind: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: "edge";
      edgeId: string;
      screenX: number;
      screenY: number;
    }
  | {
      type: "pane";
      flowPosition: { x: number; y: number };
      screenX: number;
      screenY: number;
    };

export interface GraphCanvasContextMenuProps {
  layoutEditable: boolean;
  menu: GraphCanvasContextMenuState | null;
  onAddObject: () => void;
  onClose: () => void;
  onCopy: (text: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onInspectEdge: (edgeId: string) => void;
  onInspectNode: (nodeId: string) => void;
}

export function GraphCanvasContextMenu({
  layoutEditable,
  menu,
  onAddObject,
  onClose,
  onCopy,
  onDeleteEdge,
  onDeleteNode,
  onDuplicateNode,
  onInspectEdge,
  onInspectNode
}: GraphCanvasContextMenuProps) {
  const { fitView } = useReactFlow();
  if (!menu) {
    return null;
  }

  return (
    <div
      className="canvas-context-menu"
      onClick={(event) => event.stopPropagation()}
      style={{ left: menu.screenX, top: menu.screenY }}
    >
      {menu.type === "node" ? (
        <>
          <button onClick={() => onInspectNode(menu.nodeId)} type="button">Inspect</button>
          {layoutEditable ? <button onClick={() => onDuplicateNode(menu.nodeId)} type="button">Duplicate</button> : null}
          <button onClick={() => onCopy(menu.nodeId)} type="button">Copy Node ID</button>
          <button onClick={() => onCopy(`node:${menu.nodeId}`)} type="button">Copy Node Address</button>
          {layoutEditable ? <button className="is-danger" onClick={() => onDeleteNode(menu.nodeId)} type="button">Delete</button> : null}
        </>
      ) : null}
      {menu.type === "edge" ? (
        <>
          <button onClick={() => onInspectEdge(menu.edgeId)} type="button">Inspect Cable</button>
          <button onClick={() => onCopy(menu.edgeId)} type="button">Copy Edge ID</button>
          {layoutEditable ? <button className="is-danger" onClick={() => onDeleteEdge(menu.edgeId)} type="button">Delete Cable</button> : null}
        </>
      ) : null}
      {menu.type === "pane" ? (
        <>
          {layoutEditable ? (
            <button onClick={onAddObject} type="button">Add Object</button>
          ) : null}
          <button
            onClick={() => {
              fitView({ padding: 0.2 });
              onClose();
            }}
            type="button"
          >
            Fit View
          </button>
        </>
      ) : null}
    </div>
  );
}
