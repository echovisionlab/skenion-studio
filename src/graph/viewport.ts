export interface CanvasViewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_CANVAS_VIEWPORT: CanvasViewport = {
  x: 0,
  y: 0,
  zoom: 1
};

export function canvasViewportEquals(a: CanvasViewport | null, b: CanvasViewport | null): boolean {
  return a?.x === b?.x && a?.y === b?.y && a?.zoom === b?.zoom;
}
