export interface DeferredHorizontalNumberDragOptions {
  eventTarget?: PointerDragEventTarget;
  event: {
    clientX: number;
    currentTarget: {
      releasePointerCapture?: (pointerId: number) => void;
      setPointerCapture?: (pointerId: number) => void;
    };
    pointerId: number;
    preventDefault: () => void;
    stopPropagation: () => void;
  };
  onCancel?: () => void;
  onCommit: (value: number) => void;
  onPreview: (value: number) => void;
  precision?: number;
  shiftStep?: number;
  startValue: number;
  step?: number;
}

interface PointerDragEventTarget {
  addEventListener: (
    type: "pointermove" | "pointerup" | "pointercancel",
    listener: EventListener,
    options?: AddEventListenerOptions
  ) => void;
  removeEventListener: (type: "pointermove" | "pointerup" | "pointercancel", listener: EventListener) => void;
}

interface PointerDragMoveEvent extends Event {
  clientX: number;
  shiftKey?: boolean;
}

export function beginDeferredHorizontalNumberDrag({
  event,
  eventTarget,
  onCancel,
  onCommit,
  onPreview,
  precision = 4,
  shiftStep = 0.1,
  startValue,
  step = 0.01
}: DeferredHorizontalNumberDragOptions) {
  event.preventDefault();
  event.stopPropagation();

  const startX = event.clientX;
  const pointerId = event.pointerId;
  const target = event.currentTarget;
  const listenerTarget = eventTarget ?? window;
  let latestValue = startValue;

  target.setPointerCapture?.(pointerId);

  const cleanup = () => {
    listenerTarget.removeEventListener("pointermove", onMove);
    listenerTarget.removeEventListener("pointerup", onFinish);
    listenerTarget.removeEventListener("pointercancel", onCancelDrag);
    target.releasePointerCapture?.(pointerId);
  };

  const onMove: EventListener = (event) => {
    const moveEvent = event as PointerDragMoveEvent;
    const delta = moveEvent.clientX - startX;
    const activeStep = moveEvent.shiftKey ? shiftStep : step;
    latestValue = Number((startValue + delta * activeStep).toFixed(precision));
    onPreview(latestValue);
  };

  const onFinish = () => {
    cleanup();
    if (!Object.is(latestValue, startValue)) {
      onCommit(latestValue);
    }
  };

  const onCancelDrag = () => {
    cleanup();
    onCancel?.();
  };

  listenerTarget.addEventListener("pointermove", onMove);
  listenerTarget.addEventListener("pointerup", onFinish, { once: true });
  listenerTarget.addEventListener("pointercancel", onCancelDrag, { once: true });
}
