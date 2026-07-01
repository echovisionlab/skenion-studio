import { useRef, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { GripVertical, X } from "lucide-react";
import { IconButton } from "../core/IconButton/IconButton";
import styles from "./FloatingPanel.module.css";

export interface FloatingPanelPosition {
  height: number;
  width: number;
  x: number;
  y: number;
  zIndex: number;
}

export interface FloatingPanelProps {
  children?: ReactNode;
  onActivate: () => void;
  onClose: () => void;
  onMove: (position: { x: number; y: number }) => void;
  onPointerEnter?: () => void;
  onResize?: (size: { height: number; width: number }) => void;
  position: FloatingPanelPosition;
  title: string;
}

interface DragState {
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
}

interface ResizeState {
  originHeight: number;
  originWidth: number;
  pointerId: number;
  startX: number;
  startY: number;
}

const MIN_FLOATING_PANEL_WIDTH = 220;
const MIN_FLOATING_PANEL_HEIGHT = 180;

export function FloatingPanel({
  children,
  onActivate,
  onClose,
  onMove,
  onPointerEnter,
  onResize,
  position,
  title
}: FloatingPanelProps) {
  const dragStateRef = useRef<DragState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);

  function beginDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    onActivate();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      originX: position.x,
      originY: position.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    onMove(
      clampFloatingPanelPosition(
        {
          x: drag.originX + event.clientX - drag.startX,
          y: drag.originY + event.clientY - drag.startY
        },
        { height: position.height, width: position.width }
      )
    );
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginResize(event: PointerEvent<HTMLDivElement>) {
    if (!onResize || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onActivate();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStateRef.current = {
      originHeight: position.height,
      originWidth: position.width,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
  }

  function moveResize(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeStateRef.current;
    if (!onResize || !resize || resize.pointerId !== event.pointerId) {
      return;
    }
    onResize(
      clampFloatingPanelSize(
        {
          height: resize.originHeight + event.clientY - resize.startY,
          width: resize.originWidth + event.clientX - resize.startX
        },
        { x: position.x, y: position.y }
      )
    );
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    const resize = resizeStateRef.current;
    if (!resize || resize.pointerId !== event.pointerId) {
      return;
    }
    resizeStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const panel = (
    <section
      aria-label={title}
      className={styles.panel}
      onPointerDown={onActivate}
      onPointerEnter={onPointerEnter}
      style={{
        height: position.height,
        left: position.x,
        top: position.y,
        width: position.width,
        zIndex: position.zIndex
      }}
    >
      <div className={styles.header}>
        <div
          aria-label={`Move ${title}`}
          className={styles.dragHandle}
          onPointerCancel={endDrag}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          role="button"
          tabIndex={0}
        >
          <GripVertical aria-hidden="true" size={14} />
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.actions}>
          <IconButton
            icon={<X size={13} />}
            label={`Close ${title}`}
            onClick={onClose}
            size={22}
          />
        </div>
      </div>
      <div className={[styles.body, "floating-panel-body"].join(" ")}>
        {children}
      </div>
      {onResize ? (
        <div
          aria-label={`Resize ${title}`}
          className={styles.resizeHandle}
          onPointerCancel={endResize}
          onPointerDown={beginResize}
          onPointerMove={moveResize}
          onPointerUp={endResize}
          role="button"
          tabIndex={0}
        />
      ) : null}
    </section>
  );

  return typeof document === "undefined" ? panel : createPortal(panel, document.body);
}

export function clampFloatingPanelSize(
  next: { height: number; width: number },
  position: { x: number; y: number },
  viewport = currentViewport()
): { height: number; width: number } {
  const margin = 4;
  const maxWidth = Math.max(MIN_FLOATING_PANEL_WIDTH, viewport.width - position.x - margin);
  const maxHeight = Math.max(MIN_FLOATING_PANEL_HEIGHT, viewport.height - position.y - margin);

  return {
    height: Math.min(Math.max(MIN_FLOATING_PANEL_HEIGHT, next.height), maxHeight),
    width: Math.min(Math.max(MIN_FLOATING_PANEL_WIDTH, next.width), maxWidth)
  };
}

export function clampFloatingPanelPosition(
  next: { x: number; y: number },
  size: { height: number; width: number },
  viewport = currentViewport()
): { x: number; y: number } {
  const margin = 4;
  const minimumVisibleHeader = 30;
  const maxX = Math.max(margin, viewport.width - size.width - margin);
  const maxY = Math.max(margin, viewport.height - minimumVisibleHeader - margin);

  return {
    x: Math.min(Math.max(margin, next.x), maxX),
    y: Math.min(Math.max(margin, next.y), maxY)
  };
}

function currentViewport() {
  if (typeof window === "undefined") {
    return { height: 720, width: 1024 };
  }
  return {
    height: window.innerHeight,
    width: window.innerWidth
  };
}
