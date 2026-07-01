import type { CanvasViewport } from "./viewport";

export type ViewportCacheSurface = "desktop" | "web";

export interface ViewportCacheKey {
  documentId: string;
  graphId: string;
  surface: ViewportCacheSurface;
}

const STORAGE_PREFIX = "skenion.studio.viewport.v1";

export function readCachedViewport(key: ViewportCacheKey): CanvasViewport | null {
  const storage = browserLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    return parseViewport(storage.getItem(storageKey(key)));
  } catch {
    return null;
  }
}

export function writeCachedViewport(key: ViewportCacheKey, viewport: CanvasViewport): void {
  const storage = browserLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(storageKey(key), JSON.stringify(viewport));
  } catch {
    // Viewport persistence is a convenience cache. Ignore quota/private-mode failures.
  }
}

function storageKey(key: ViewportCacheKey): string {
  return `${STORAGE_PREFIX}:${key.surface}:${encodeURIComponent(key.documentId)}:${encodeURIComponent(key.graphId)}`;
}

function browserLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function parseViewport(value: string | null): CanvasViewport | null {
  if (!value) {
    return null;
  }
  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed)) {
    return null;
  }
  const x = parsed.x;
  const y = parsed.y;
  const zoom = parsed.zoom;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof zoom !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(zoom) ||
    zoom <= 0
  ) {
    return null;
  }
  return { x, y, zoom };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
