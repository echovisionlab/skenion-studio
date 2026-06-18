import { describe, expect, it, vi } from "vitest";
import { beginDeferredHorizontalNumberDrag } from "./deferredPointerDrag";

describe("beginDeferredHorizontalNumberDrag", () => {
  it("previews during pointer movement but commits only on pointerup", () => {
    const eventTarget = new EventTarget();
    const target = dragTarget();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalNumberDrag({
      event: dragStartEvent(target, 100),
      eventTarget,
      onCommit,
      onPreview,
      startValue: 0.5
    });

    eventTarget.dispatchEvent(pointerMoveEvent(110));
    eventTarget.dispatchEvent(pointerMoveEvent(125, true));

    expect(onPreview).toHaveBeenCalledWith(0.6);
    expect(onPreview).toHaveBeenCalledWith(3);
    expect(onCommit).not.toHaveBeenCalled();

    eventTarget.dispatchEvent(new Event("pointerup"));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(3);
    expect(target.setPointerCapture).toHaveBeenCalledWith(7);
    expect(target.releasePointerCapture).toHaveBeenCalledWith(7);
  });

  it("cancels without committing", () => {
    const eventTarget = new EventTarget();
    const target = dragTarget();
    const onCancel = vi.fn();
    const onPreview = vi.fn();
    const onCommit = vi.fn();

    beginDeferredHorizontalNumberDrag({
      event: dragStartEvent(target, 100),
      eventTarget,
      onCancel,
      onCommit,
      onPreview,
      startValue: 1
    });

    eventTarget.dispatchEvent(pointerMoveEvent(120));
    eventTarget.dispatchEvent(new Event("pointercancel"));

    expect(onPreview).toHaveBeenCalledWith(1.2);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });
});

function dragTarget() {
  return {
    releasePointerCapture: vi.fn(),
    setPointerCapture: vi.fn()
  };
}

function dragStartEvent(target: ReturnType<typeof dragTarget>, clientX: number) {
  return {
    clientX,
    currentTarget: target,
    pointerId: 7,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

function pointerMoveEvent(clientX: number, shiftKey = false) {
  const event = new Event("pointermove");
  Object.defineProperties(event, {
    clientX: { value: clientX },
    shiftKey: { value: shiftKey }
  });
  return event;
}
