import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canvasViewportEquals,
  DEFAULT_CANVAS_VIEWPORT,
} from "./viewport";
import {
  readCachedViewport,
  writeCachedViewport,
  type ViewportCacheKey
} from "./viewportCache";

const key: ViewportCacheKey = {
  documentId: "11111111-1111-4111-8111-111111111111",
  graphId: "root",
  surface: "web"
};

describe("viewportCache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createMemoryStorage()
    });
  });

  it("stores viewport per document graph and studio surface", () => {
    writeCachedViewport(key, { x: -12, y: 40, zoom: 0.75 });
    writeCachedViewport({ ...key, surface: "desktop" }, { x: 1, y: 2, zoom: 3 });

    expect(readCachedViewport(key)).toEqual({ x: -12, y: 40, zoom: 0.75 });
    expect(readCachedViewport({ ...key, surface: "desktop" })).toEqual({ x: 1, y: 2, zoom: 3 });
    expect(readCachedViewport({ ...key, graphId: "other" })).toBeNull();
  });

  it("ignores corrupt or non-positive viewport cache entries", () => {
    window.localStorage.setItem(
      "skenion.studio.viewport.v1:web:11111111-1111-4111-8111-111111111111:root",
      JSON.stringify({ x: 0, y: 0, zoom: 0 })
    );

    expect(readCachedViewport(key)).toBeNull();
  });

  it("ignores unavailable or failing storage", () => {
    vi.unstubAllGlobals();
    expect(readCachedViewport(key)).toBeNull();
    expect(() => writeCachedViewport(key, DEFAULT_CANVAS_VIEWPORT)).not.toThrow();

    vi.stubGlobal("window", {
      localStorage: {
        ...createMemoryStorage(),
        getItem: () => {
          throw new Error("read denied");
        },
        setItem: () => {
          throw new Error("write denied");
        }
      }
    });

    expect(readCachedViewport(key)).toBeNull();
    expect(() => writeCachedViewport(key, DEFAULT_CANVAS_VIEWPORT)).not.toThrow();
  });

  it("rejects malformed viewport cache shapes", () => {
    for (const value of [
      "",
      "not-json",
      JSON.stringify([]),
      JSON.stringify({ x: "0", y: 0, zoom: 1 }),
      JSON.stringify({ x: 0, y: "0", zoom: 1 }),
      JSON.stringify({ x: 0, y: 0, zoom: "1" }),
      JSON.stringify({ x: Number.NaN, y: 0, zoom: 1 }),
      JSON.stringify({ x: 0, y: Number.NaN, zoom: 1 }),
      JSON.stringify({ x: 0, y: 0, zoom: Number.NaN })
    ]) {
      window.localStorage.setItem(
        "skenion.studio.viewport.v1:web:11111111-1111-4111-8111-111111111111:root",
        value
      );
      expect(readCachedViewport(key)).toBeNull();
    }
  });

  it("compares local viewport values", () => {
    expect(DEFAULT_CANVAS_VIEWPORT).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvasViewportEquals(DEFAULT_CANVAS_VIEWPORT, { x: 0, y: 0, zoom: 1 })).toBe(true);
    expect(canvasViewportEquals(DEFAULT_CANVAS_VIEWPORT, { x: 0, y: 1, zoom: 1 })).toBe(false);
    expect(canvasViewportEquals(DEFAULT_CANVAS_VIEWPORT, null)).toBe(false);
    expect(canvasViewportEquals(null, null)).toBe(true);
  });
});

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (name) => entries.get(name) ?? null,
    key: (index) => Array.from(entries.keys())[index] ?? null,
    removeItem: (name) => entries.delete(name),
    setItem: (name, value) => entries.set(name, value)
  };
}
