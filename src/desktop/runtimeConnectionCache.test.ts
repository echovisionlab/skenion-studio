import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readCachedRuntimeConnectionPreference,
  writeCachedRuntimeConnectionPreference
} from "./runtimeConnectionCache";

describe("runtimeConnectionCache", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: createMemoryStorage()
    });
  });

  it("stores the last runtime connection preference", () => {
    writeCachedRuntimeConnectionPreference({
      activeProfileId: "remote",
      autoConnect: true,
      remoteRuntimeUrl: " http://localhost:3761/ ",
      sessionId: " session-a "
    });

    expect(readCachedRuntimeConnectionPreference()).toMatchObject({
      activeProfileId: "remote",
      autoConnect: true,
      remoteRuntimeUrl: "http://localhost:3761",
      sessionId: "session-a"
    });
  });

  it("defaults empty session and remote endpoint values", () => {
    writeCachedRuntimeConnectionPreference({
      activeProfileId: "local",
      autoConnect: false,
      remoteRuntimeUrl: "",
      sessionId: ""
    });

    expect(readCachedRuntimeConnectionPreference()).toMatchObject({
      activeProfileId: "local",
      autoConnect: false,
      remoteRuntimeUrl: "http://localhost:3761",
      sessionId: "default"
    });
  });

  it("ignores corrupt or invalid cache entries", () => {
    for (const value of [
      "",
      "not-json",
      JSON.stringify([]),
      JSON.stringify({ activeProfileId: "shared", remoteRuntimeUrl: "http://localhost:3761" }),
      JSON.stringify({ activeProfileId: "remote", remoteRuntimeUrl: "not a url" })
    ]) {
      window.localStorage.setItem("skenion.studio.runtimeConnection.v1", value);
      expect(readCachedRuntimeConnectionPreference()).toBeNull();
    }
  });

  it("ignores unavailable or failing storage", () => {
    vi.unstubAllGlobals();
    expect(readCachedRuntimeConnectionPreference()).toBeNull();
    expect(() =>
      writeCachedRuntimeConnectionPreference({
        activeProfileId: "remote",
        autoConnect: true,
        remoteRuntimeUrl: "http://localhost:3761",
        sessionId: "default"
      })
    ).not.toThrow();

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

    expect(readCachedRuntimeConnectionPreference()).toBeNull();
    expect(() =>
      writeCachedRuntimeConnectionPreference({
        activeProfileId: "remote",
        autoConnect: true,
        remoteRuntimeUrl: "http://localhost:3761",
        sessionId: "default"
      })
    ).not.toThrow();
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
