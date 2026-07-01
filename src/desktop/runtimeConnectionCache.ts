import { DEFAULT_RUNTIME_URL, normalizeRuntimeUrl } from "../runtime/client";
import {
  DEFAULT_RUNTIME_SESSION_ID,
  type RuntimeProfileId
} from "./runtimeProfiles";

export interface RuntimeConnectionPreference {
  activeProfileId: RuntimeProfileId;
  autoConnect: boolean;
  remoteRuntimeUrl: string;
  sessionId: string;
  updatedAt: string;
}

export interface RuntimeConnectionPreferenceInput {
  activeProfileId: RuntimeProfileId;
  autoConnect: boolean;
  remoteRuntimeUrl: string;
  sessionId: string;
}

const STORAGE_KEY = "skenion.studio.runtimeConnection.v1";

export function readCachedRuntimeConnectionPreference(): RuntimeConnectionPreference | null {
  const storage = browserLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return parseRuntimeConnectionPreference(storage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeCachedRuntimeConnectionPreference(input: RuntimeConnectionPreferenceInput): void {
  const storage = browserLocalStorage();
  if (!storage) {
    return;
  }

  const preference = createRuntimeConnectionPreference(input);
  if (!preference) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Runtime connection persistence is a convenience cache. Ignore storage failures.
  }
}

function createRuntimeConnectionPreference(
  input: RuntimeConnectionPreferenceInput
): RuntimeConnectionPreference | null {
  if (!isRuntimeProfileId(input.activeProfileId)) {
    return null;
  }

  const remoteRuntimeUrl = normalizeCachedRuntimeUrl(input.remoteRuntimeUrl);
  if (!remoteRuntimeUrl) {
    return null;
  }

  return {
    activeProfileId: input.activeProfileId,
    autoConnect: input.autoConnect,
    remoteRuntimeUrl,
    sessionId: normalizeCachedSessionId(input.sessionId),
    updatedAt: new Date().toISOString()
  };
}

function parseRuntimeConnectionPreference(value: string | null): RuntimeConnectionPreference | null {
  if (!value) {
    return null;
  }

  const parsed = JSON.parse(value) as unknown;
  if (!isRecord(parsed) || !isRuntimeProfileId(parsed.activeProfileId)) {
    return null;
  }

  const remoteRuntimeUrl = normalizeCachedRuntimeUrl(parsed.remoteRuntimeUrl);
  if (!remoteRuntimeUrl) {
    return null;
  }

  return {
    activeProfileId: parsed.activeProfileId,
    autoConnect: parsed.autoConnect === true,
    remoteRuntimeUrl,
    sessionId: normalizeCachedSessionId(parsed.sessionId),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : ""
  };
}

function normalizeCachedRuntimeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_RUNTIME_URL;
  }

  try {
    const normalized = normalizeRuntimeUrl(value);
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? normalized : null;
  } catch {
    return null;
  }
}

function normalizeCachedSessionId(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_RUNTIME_SESSION_ID;
}

function isRuntimeProfileId(value: unknown): value is RuntimeProfileId {
  return value === "local" || value === "remote";
}

function browserLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
