import {
  validateEndpointBindingValueFormatV01,
  validateNodeCatalogSnapshotV01,
  validatePasteGraphFragmentRequest,
  validateProjectDocumentV01
} from "@skenion/contracts";
import type {
  NodeCatalogSnapshotV01,
  RuntimeApiResponse,
  RuntimeAsset,
  RuntimeAssetGetResponse,
  RuntimeAssetImportResponse,
  RuntimeAssetListResponse,
  RuntimeControlMessage,
  RuntimeControlEventRequest,
  RuntimeControlEventResponse,
  RuntimeControlReadRequest,
  RuntimeControlReadResponse,
  RuntimeControlReadValue,
  RuntimeControlStateResponse,
  RuntimeControlValue,
  RuntimeDiagnostic,
  RuntimeHealth,
  RuntimeInfo,
  RuntimeLogSnapshotResponse,
  RuntimeIoDeviceListResponse,
  RuntimeGeneratedShaderResponse,
  RuntimeExtensionListResponse,
  RuntimeHistory,
  RuntimeHistoryEntry,
  RuntimeIoDeviceDescriptor,
  RuntimeIoDiagnostic,
  RuntimeLogEvent,
  RuntimeMutationRequest,
  RuntimePreviewStartRequest,
  RuntimePreviewStatus,
  RuntimeProjectPayload,
  RuntimeSessionEvent,
  RuntimeSessionInfoResponse,
  RuntimeSessionLoadPayload,
  RuntimeSessionResponse,
  RuntimeSessionSnapshot,
  RuntimeTelemetryPreview,
  RuntimeTelemetryProcess,
  RuntimeTelemetryRender,
  RuntimeTelemetrySession,
  RuntimeTelemetrySnapshot
} from "./types";

export const DEFAULT_RUNTIME_URL =
  import.meta.env.VITE_SKENION_RUNTIME_URL?.trim() || "http://localhost:3761";

type FetchLike = typeof fetch;

export const DEFAULT_RUNTIME_SESSION_ID = "default";

export interface RuntimeClient {
  getHealth: () => Promise<RuntimeHealth>;
  getRuntimeInfo: () => Promise<RuntimeInfo>;
  getRuntimeLogs: () => Promise<RuntimeLogSnapshotResponse>;
  listExtensions: () => Promise<RuntimeExtensionListResponse>;
  validateProject: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  buildPlan: (project: RuntimeProjectPayload) => Promise<RuntimeApiResponse>;
  runProject: (project: RuntimeProjectPayload, frames: number) => Promise<RuntimeApiResponse>;
  getSessionInfo: () => Promise<RuntimeSessionInfoResponse>;
  getNodeCatalog: () => Promise<NodeCatalogSnapshotV01>;
  getSession: () => Promise<RuntimeSessionResponse>;
  loadSession: (request: RuntimeSessionLoadPayload) => Promise<RuntimeSessionResponse>;
  validateSession: () => Promise<RuntimeSessionResponse>;
  planSession: () => Promise<RuntimeSessionResponse>;
  runSession: (frames: number) => Promise<RuntimeSessionResponse>;
  getSessionHistory: () => Promise<RuntimeHistory>;
  sendControlEvent: (request: RuntimeControlEventRequest) => Promise<RuntimeControlEventResponse>;
  getControlState: () => Promise<RuntimeControlStateResponse>;
  readControl: (request: RuntimeControlReadRequest) => Promise<RuntimeControlReadResponse>;
  getPreviewStatus: () => Promise<RuntimePreviewStatus>;
  startPreview: (options?: Partial<RuntimePreviewStartRequest>) => Promise<RuntimePreviewStatus>;
  stopPreview: () => Promise<RuntimePreviewStatus>;
  restartPreview: () => Promise<RuntimePreviewStatus>;
  importAsset: (file: File, kind?: string) => Promise<RuntimeAssetImportResponse>;
  listAssets: () => Promise<RuntimeAssetListResponse>;
  getAsset: (assetId: string) => Promise<RuntimeAssetGetResponse>;
  getGeneratedShader: () => Promise<RuntimeGeneratedShaderResponse>;
  getTelemetry: () => Promise<RuntimeTelemetrySnapshot>;
  listIoDevices: () => Promise<RuntimeIoDeviceListResponse>;
  clearSession: () => Promise<RuntimeSessionResponse>;
}

export interface RuntimeClientOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  sessionId?: string | null;
}

export class RuntimeClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeClientError";
  }
}

export function createRuntimeClient(options: RuntimeClientOptions = {}): RuntimeClient {
  const baseUrl = normalizeRuntimeUrl(options.baseUrl ?? DEFAULT_RUNTIME_URL);
  const fetchImpl = options.fetchImpl ?? fetch;
  const sessionId = normalizeRuntimeSessionId(options.sessionId);
  const sessionPath = (suffix = "") => runtimeSessionPath(sessionId, suffix);

  return {
    getHealth: () => requestJson<RuntimeHealth>(fetchImpl, baseUrl, "/health", { method: "GET" }, isRuntimeHealth),
    getRuntimeInfo: () =>
      requestJson<RuntimeInfo>(fetchImpl, baseUrl, "/v0/runtime/info", { method: "GET" }, isRuntimeInfo),
    getRuntimeLogs: () =>
      requestJson<RuntimeLogSnapshotResponse>(
        fetchImpl,
        baseUrl,
        "/v0/runtime/logs",
        { method: "GET" },
        isRuntimeLogSnapshotResponse
      ),
    listExtensions: () =>
      requestJson<RuntimeExtensionListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/extensions",
        { method: "GET" },
        isRuntimeExtensionListResponse
      ),
    validateProject: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/validate", project),
    buildPlan: (project) => postRuntimeResponse(fetchImpl, baseUrl, "/v0/plan", project),
    runProject: (project, frames) =>
      postRuntimeResponse(fetchImpl, baseUrl, "/v0/run", {
        ...project,
        frames
      }),
    getSessionInfo: () =>
      requestJson<RuntimeSessionInfoResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/info"),
        { method: "GET" },
        isRuntimeSessionInfoResponse
      ),
    getNodeCatalog: () =>
      requestJson<NodeCatalogSnapshotV01>(
        fetchImpl,
        baseUrl,
        sessionPath("/node-catalog"),
        { method: "GET" },
        isNodeCatalogSnapshot
      ),
    getSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/snapshot"),
        { method: "GET" },
        isRuntimeSessionResponse
      ),
    loadSession: (project) => postRuntimeSessionResponse(fetchImpl, baseUrl, sessionPath("/load"), project),
    validateSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/validate"),
        { method: "POST" },
        isRuntimeSessionResponse
      ),
    planSession: () =>
      requestJson<RuntimeSessionResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/plan"),
        { method: "POST" },
        isRuntimeSessionResponse
      ),
    runSession: (frames) => postRuntimeSessionResponse(fetchImpl, baseUrl, sessionPath("/run"), { frames }),
    getSessionHistory: () =>
      requestJson<RuntimeHistory>(
        fetchImpl,
        baseUrl,
        sessionPath("/history"),
        { method: "GET" },
        isRuntimeHistory
      ),
    sendControlEvent: (request) =>
      postRuntimeControlEventResponse(fetchImpl, baseUrl, sessionPath("/control/event"), request),
    getControlState: () =>
      requestJson<RuntimeControlStateResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/control/state"),
        { method: "GET" },
        isRuntimeControlStateResponse
      ),
    readControl: (request) =>
      requestJson<RuntimeControlReadResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/control/read"),
        {
          body: JSON.stringify(request),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        },
        isRuntimeControlReadResponse
      ),
    getPreviewStatus: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview"),
        { method: "GET" },
        isRuntimePreviewStatus
      ),
    startPreview: (options = {}) =>
      postRuntimePreviewStatus(fetchImpl, baseUrl, sessionPath("/preview/start"), {
        restart: options.restart ?? false
      }),
    stopPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview/stop"),
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    restartPreview: () =>
      requestJson<RuntimePreviewStatus>(
        fetchImpl,
        baseUrl,
        sessionPath("/preview/restart"),
        { method: "POST" },
        isRuntimePreviewStatus
      ),
    importAsset: (file, kind) => {
      void kind;
      const form = new FormData();
      form.set("file", file);
      return requestJson<RuntimeAssetImportResponse>(
        fetchImpl,
        baseUrl,
        "/v0/assets/import",
        {
          body: form,
          method: "POST"
        },
        isRuntimeAssetImportResponse
      );
    },
    listAssets: () =>
      requestJson<RuntimeAssetListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/assets",
        { method: "GET" },
        isRuntimeAssetListResponse
      ),
    getAsset: (assetId) =>
      requestJson<RuntimeAssetGetResponse>(
        fetchImpl,
        baseUrl,
        `/v0/assets/${encodeURIComponent(assetId)}`,
        { method: "GET" },
        isRuntimeAssetGetResponse
      ),
    getGeneratedShader: () =>
      requestJson<RuntimeGeneratedShaderResponse>(
        fetchImpl,
        baseUrl,
        sessionPath("/render/generated-shader"),
        { method: "GET" },
        isRuntimeGeneratedShaderResponse
      ),
    getTelemetry: () =>
      requestJson<RuntimeTelemetrySnapshot>(
        fetchImpl,
        baseUrl,
        sessionPath("/telemetry"),
        { method: "GET" },
        isRuntimeTelemetrySnapshot
      ),
    listIoDevices: () =>
      requestJson<RuntimeIoDeviceListResponse>(
        fetchImpl,
        baseUrl,
        "/v0/io/devices",
        { method: "GET" },
        isRuntimeIoDeviceListResponse
      ),
    clearSession: () =>
      requestJson<RuntimeSessionResponse>(fetchImpl, baseUrl, sessionPath(), { method: "DELETE" }, isRuntimeSessionResponse)
  };
}

export function normalizeRuntimeUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new RuntimeClientError("Runtime URL is required.");
  }

  return trimmed.replace(/\/+$/, "");
}

export function normalizeRuntimeSessionId(sessionId?: string | null): string | null {
  const trimmed = sessionId?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function runtimeSessionPath(sessionId?: string | null, suffix = ""): string {
  const normalizedSessionId = normalizeRuntimeSessionId(sessionId);
  const explicitSessionId = normalizedSessionId ?? DEFAULT_RUNTIME_SESSION_ID;
  return `/v0/sessions/${encodeURIComponent(explicitSessionId)}${suffix}`;
}

export function runtimeLogStreamUrl(url: string = DEFAULT_RUNTIME_URL): string {
  return `${normalizeRuntimeUrl(url)}/v0/runtime/logs/stream`;
}

export function runtimeSessionEventsStreamUrl(
  url: string = DEFAULT_RUNTIME_URL,
  sessionId?: string | null
): string {
  return `${normalizeRuntimeUrl(url)}${runtimeSessionPath(sessionId, "/events/stream")}`;
}

const SHADER_DIAGNOSTIC_SEVERITIES = new Set(["error", "warning", "info"]);
const SHADER_DIAGNOSTIC_PHASES = new Set([
  "interface-analysis",
  "source-sync",
  "wgsl-generation",
  "wgsl-compile",
  "render-pipeline",
  "render-frame"
]);
const SHADER_DIAGNOSTIC_SOURCES = new Set(["user", "generated", "runtime"]);
const RUNTIME_SESSION_LIFECYCLE_STATES = new Set(["initializing", "ready", "closing", "closed", "error"]);
const RUNTIME_CONNECTION_PROFILE_MODES = new Set(["local-managed", "local-shared", "remote"]);
const RUNTIME_OWNERSHIP_MODES = new Set(["owned-child", "external", "remote"]);
const RUNTIME_EVENT_REPLAY_GAP_REASONS = new Set(["retention-overflow", "stream-reset", "unknown"]);

function isRuntimeHealth(value: unknown): value is RuntimeHealth {
  return isRecord(value) && typeof value.ok === "boolean" && typeof value.service === "string" && typeof value.version === "string";
}

function isRuntimeInfo(value: unknown): value is RuntimeInfo {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.apiVersion === "string" &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((capability) => typeof capability === "string")
  );
}

function isRuntimeLogSnapshotResponse(value: unknown): value is RuntimeLogSnapshotResponse {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.logs" &&
    typeof value.schemaVersion === "string" &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.events) &&
    value.events.every(isRuntimeLogEvent) &&
    isRecord(value.retention) &&
    typeof value.retention.replayLimit === "number" &&
    Array.isArray(value.retention.replayLevels) &&
    value.retention.replayLevels.every(isRuntimeDiagnosticSeverity) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

export function isRuntimeLogEvent(value: unknown): value is RuntimeLogEvent {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    typeof value.timestamp === "string" &&
    value.source === "runtime" &&
    isRuntimeDiagnosticSeverity(value.level) &&
    (value.code === null || typeof value.code === "string") &&
    typeof value.message === "string"
  );
}

function isRuntimeApiResponse(value: unknown): value is RuntimeApiResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.plan === null || isRecord(value.plan)) &&
    (value.report === null || isRecord(value.report))
  );
}

function isRuntimeSessionResponse(value: unknown): value is RuntimeSessionResponse {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["ok", "snapshot", "diagnostics", "report"]) &&
    typeof value.ok === "boolean" &&
    !("loaded" in value) &&
    !("graphId" in value) &&
    !("graphRevision" in value) &&
    !("viewState" in value) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.report === null || isRecord(value.report))
  );
}

function isRuntimeSessionInfoResponse(value: unknown): value is RuntimeSessionInfoResponse {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "schema",
      "schemaVersion",
      "ok",
      "sessionId",
      "lifecycle",
      "snapshot",
      "profile",
      "capabilities",
      "eventReplay",
      "diagnostics"
    ]) &&
    value.schema === "skenion.runtime.session.info" &&
    value.schemaVersion === "0.1.0" &&
    typeof value.ok === "boolean" &&
    isNonEmptyString(value.sessionId) &&
    isRuntimeSessionLifecycleState(value.lifecycle) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    isRuntimeConnectionProfile(value.profile) &&
    isRuntimeSessionCapabilitySet(value.capabilities) &&
    isRuntimeEventReplayWindow(value.eventReplay) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeOperationEnvelope(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.operation" &&
    value.schemaVersion === "0.1.0" &&
    typeof value.id === "string" &&
    value.kind === "pasteGraphFragment" &&
    validatePasteGraphFragmentRequest(value.request).ok &&
    (value.attribution === undefined || isRuntimeOperationAttribution(value.attribution)) &&
    (value.correlationId === undefined || typeof value.correlationId === "string") &&
    (value.createdAt === undefined || typeof value.createdAt === "string")
  );
}

export function isRuntimeSessionEvent(value: unknown): value is RuntimeSessionEvent {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "schema",
      "schemaVersion",
      "id",
      "sessionId",
      "sequence",
      "sessionRevision",
      "kind",
      "snapshot",
      "history",
      "mutation",
      "replay",
      "diagnostics",
      "createdAt"
    ]) &&
    value.schema === "skenion.runtime.session.event" &&
    value.schemaVersion === "0.1.0" &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.sessionId) &&
    isNonNegativeInteger(value.sequence) &&
    value.sequence >= 1 &&
    isNonNegativeInteger(value.sessionRevision) &&
    isRuntimeSessionEventKind(value.kind) &&
    isRuntimeSessionSnapshot(value.snapshot) &&
    value.sessionRevision === value.snapshot.sessionRevision &&
    !("session" in value) &&
    !("graph" in value) &&
    !("viewState" in value) &&
    !("graphEvent" in value) &&
    isRuntimeHistory(value.history) &&
    (value.mutation === undefined || isRuntimeHistoryEntry(value.mutation)) &&
    isRuntimeEventReplayMetadata(value.replay) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    isNonEmptyString(value.createdAt)
  );
}

function isRuntimeHistory(value: unknown): value is RuntimeHistory {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["schema", "schemaVersion", "entries", "canUndo", "canRedo", "undoDepth", "redoDepth"]) &&
    value.schema === "skenion.runtime.history" &&
    value.schemaVersion === "0.1.0" &&
    Array.isArray(value.entries) &&
    value.entries.every(isRuntimeHistoryEntry) &&
    typeof value.canUndo === "boolean" &&
    typeof value.canRedo === "boolean" &&
    isNonNegativeInteger(value.undoDepth) &&
    isNonNegativeInteger(value.redoDepth)
  );
}

function isRuntimeControlEventResponse(value: unknown): value is RuntimeControlEventResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.changed === "boolean" &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    Array.isArray(value.emitted) &&
    value.emitted.every(isRuntimeControlEmission) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlStateResponse(value: unknown): value is RuntimeControlStateResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    typeof value.controlRevision === "number" &&
    isRecord(value.values) &&
    Object.values(value.values).every(isRuntimeControlValue) &&
    isRecord(value.channels) &&
    Object.values(value.channels).every(isRuntimeControlMessage) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeControlReadResponse(value: unknown): value is RuntimeControlReadResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    isRuntimeControlReadRequest(value.address) &&
    (value.value === null || isRuntimeControlReadValue(value.value)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimePreviewStatus(value: unknown): value is RuntimePreviewStatus {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    isRuntimePreviewState(value.state) &&
    (typeof value.pid === "number" || value.pid === null) &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    (typeof value.sessionRevision === "number" || value.sessionRevision === null) &&
    (typeof value.previewSessionRevision === "number" || value.previewSessionRevision === null) &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null) &&
    typeof value.stale === "boolean" &&
    (typeof value.startedAt === "string" || value.startedAt === null) &&
    (typeof value.exitedAt === "string" || value.exitedAt === null) &&
    (typeof value.exitCode === "number" || value.exitCode === null) &&
    (typeof value.message === "string" || value.message === null) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAssetImportResponse(value: unknown): value is RuntimeAssetImportResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (value.asset === null || isRuntimeAsset(value.asset)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAssetListResponse(value: unknown): value is RuntimeAssetListResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.assets) &&
    value.assets.every(isRuntimeAsset) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeAssetGetResponse(value: unknown): value is RuntimeAssetGetResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (value.asset === null || isRuntimeAsset(value.asset)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeIoDeviceListResponse(value: unknown): value is RuntimeIoDeviceListResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.devices) &&
    value.devices.every(isRuntimeIoDeviceDescriptor) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeIoDiagnostic)
  );
}

function isRuntimeTelemetrySnapshot(value: unknown): value is RuntimeTelemetrySnapshot {
  return (
    isRecord(value) &&
    value.schema === "skenion.runtime.telemetry" &&
    value.schemaVersion === "0.1.0" &&
    typeof value.ok === "boolean" &&
    typeof value.timestamp === "string" &&
    isRuntimeTelemetrySession(value.session) &&
    isRuntimeTelemetryPreview(value.preview) &&
    isRuntimeTelemetryRender(value.render) &&
    isRuntimeTelemetryProcess(value.process) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isRuntimeGeneratedShaderResponse(value: unknown): value is RuntimeGeneratedShaderResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    (typeof value.nodeId === "string" || value.nodeId === null) &&
    (value.language === "wgsl" || value.language === null) &&
    (typeof value.source === "string" || value.source === null) &&
    (value.sourceMap === null || isGeneratedShaderSourceMap(value.sourceMap)) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isShaderDiagnostic)
  );
}

function isRuntimeExtensionListResponse(value: unknown): value is RuntimeExtensionListResponse {
  return (
    isRecord(value) &&
    typeof value.ok === "boolean" &&
    Array.isArray(value.extensions) &&
    value.extensions.every(isRuntimeExtensionDescriptor) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

async function postRuntimeResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: unknown
): Promise<RuntimeApiResponse> {
  return requestJson<RuntimeApiResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeApiResponse
  );
}

async function postRuntimeSessionResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: unknown
): Promise<RuntimeSessionResponse> {
  return requestJson<RuntimeSessionResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeSessionResponse
  );
}

function isRuntimeSessionSnapshot(value: unknown): value is RuntimeSessionSnapshot {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["sessionRevision", "viewRevision", "controlRevision", "project", "bindingFormats", "diagnostics", "plan"]) &&
    isNonNegativeInteger(value.sessionRevision) &&
    isNonNegativeInteger(value.viewRevision) &&
    isNonNegativeInteger(value.controlRevision) &&
    (value.project === null || isRuntimeProjectSnapshot(value.project)) &&
    Array.isArray(value.bindingFormats) &&
    value.bindingFormats.every((bindingFormat) => validateEndpointBindingValueFormatV01(bindingFormat).ok) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic) &&
    (value.plan === null || isRecord(value.plan))
  );
}

function isRuntimeProjectSnapshot(value: unknown): boolean {
  return validateProjectDocumentV01(value).ok;
}

function isRuntimeSessionLifecycleState(value: unknown): boolean {
  return typeof value === "string" && RUNTIME_SESSION_LIFECYCLE_STATES.has(value);
}

function isRuntimeConnectionProfileMode(value: unknown): boolean {
  return typeof value === "string" && RUNTIME_CONNECTION_PROFILE_MODES.has(value);
}

function isRuntimeOwnershipMode(value: unknown): boolean {
  return typeof value === "string" && RUNTIME_OWNERSHIP_MODES.has(value);
}

function isRuntimeEndpointMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["url", "canonicalUrl", "protocol", "host", "port", "tls"]) &&
    isNonEmptyString(value.url) &&
    (value.canonicalUrl === undefined || isNonEmptyString(value.canonicalUrl)) &&
    (value.protocol === "http" || value.protocol === "https") &&
    (value.host === undefined || isNonEmptyString(value.host)) &&
    (value.port === undefined ||
      (typeof value.port === "number" && Number.isInteger(value.port) && value.port >= 0 && value.port <= 65535)) &&
    (value.tls === undefined || typeof value.tls === "boolean")
  );
}

function isRuntimeProcessMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, [
      "ownedByHost",
      "pid",
      "executablePath",
      "workingDirectory",
      "startedAt",
      "ownerWindowId",
      "platform",
      "arch"
    ]) &&
    typeof value.ownedByHost === "boolean" &&
    (value.pid === undefined || (typeof value.pid === "number" && Number.isInteger(value.pid) && value.pid >= 1)) &&
    (value.executablePath === undefined || isNonEmptyString(value.executablePath)) &&
    (value.workingDirectory === undefined || isNonEmptyString(value.workingDirectory)) &&
    (value.startedAt === undefined || typeof value.startedAt === "string") &&
    (value.ownerWindowId === undefined || isNonEmptyString(value.ownerWindowId)) &&
    (value.platform === undefined || isNonEmptyString(value.platform)) &&
    (value.arch === undefined || isNonEmptyString(value.arch))
  );
}

function isRuntimeConnectionProfile(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["mode", "ownership", "displayName", "endpoint", "process"]) &&
    isRuntimeConnectionProfileMode(value.mode) &&
    isRuntimeOwnershipMode(value.ownership) &&
    runtimeProfileOwnershipMatches(value.mode, value.ownership) &&
    (value.displayName === undefined || typeof value.displayName === "string") &&
    isRuntimeEndpointMetadata(value.endpoint) &&
    (value.process === undefined || value.process === null || isRuntimeProcessMetadata(value.process))
  );
}

function isRuntimeEventReplayWindow(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["cursorKind", "currentCursor", "earliestSequence", "latestSequence", "replayLimit", "overflow"]) &&
    value.cursorKind === "sequence" &&
    isNonEmptyString(value.currentCursor) &&
    isNonNegativeInteger(value.earliestSequence) &&
    value.earliestSequence >= 1 &&
    isNonNegativeInteger(value.latestSequence) &&
    (value.replayLimit === null ||
      (typeof value.replayLimit === "number" && Number.isInteger(value.replayLimit) && value.replayLimit >= 0)) &&
    (value.overflow === undefined || typeof value.overflow === "boolean")
  );
}

function isRuntimeSessionCapabilitySet(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["sessionAddressing", "eventReplay", "multiWindow", "authPolicy"]) &&
    typeof value.sessionAddressing === "boolean" &&
    typeof value.eventReplay === "boolean" &&
    typeof value.multiWindow === "boolean" &&
    value.authPolicy === "deferred"
  );
}

function isRuntimeEventReplayGap(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["expectedSequence", "actualSequence", "reason"]) &&
    isNonNegativeInteger(value.expectedSequence) &&
    value.expectedSequence >= 1 &&
    isNonNegativeInteger(value.actualSequence) &&
    value.actualSequence >= 1 &&
    value.expectedSequence < value.actualSequence &&
    typeof value.reason === "string" &&
    RUNTIME_EVENT_REPLAY_GAP_REASONS.has(value.reason)
  );
}

function isRuntimeEventReplayMetadata(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["cursor", "previousCursor", "replayed", "gap", "overflow"]) &&
    isNonEmptyString(value.cursor) &&
    (value.previousCursor === null || isNonEmptyString(value.previousCursor)) &&
    typeof value.replayed === "boolean" &&
    (value.gap === null || isRuntimeEventReplayGap(value.gap)) &&
    typeof value.overflow === "boolean"
  );
}

function isRuntimeSessionEventKind(value: unknown): boolean {
  return value === "snapshot" || value === "load" || value === "clear" || value === "mutate" || value === "undo" || value === "redo";
}

function isRuntimeOperationAttribution(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.actorId === undefined || typeof value.actorId === "string") &&
    (value.clientId === undefined || typeof value.clientId === "string") &&
    (value.label === undefined || typeof value.label === "string")
  );
}

function isRuntimeControlReadRequest(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.nodeId === "string" &&
    (value.target === "param" || value.target === "port" || value.target === "state") &&
    typeof value.id === "string"
  );
}

function isRuntimeControlReadValue(value: unknown): value is RuntimeControlReadValue {
  return isRuntimeControlValue(value) || (isRecord(value) && value.type === "json" && "value" in value);
}

function isRuntimeControlEmission(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.nodeId === "string" &&
    (value.portId === "value" || value.portId === "in" || value.portId === "out") &&
    isRuntimeControlMessage(value.message)
  );
}

function isRuntimeControlMessage(value: unknown): value is RuntimeControlMessage {
  return (
    isRecord(value) &&
    typeof value.selector === "string" &&
    Array.isArray(value.atoms) &&
    value.atoms.every(isRuntimeControlValue)
  );
}

function isRuntimeControlValue(value: unknown): value is RuntimeControlValue {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }
  if (value.type === "float") {
    return typeof value.representation === "string" && typeof value.value === "number" && Number.isFinite(value.value);
  }
  if (value.type === "int" || value.type === "uint") {
    return typeof value.representation === "string" && typeof value.value === "number" && Number.isInteger(value.value);
  }
  if (value.type === "bool") {
    return typeof value.value === "boolean";
  }
  if (value.type === "string") {
    return typeof value.value === "string";
  }
  if (value.type === "color") {
    return (
      typeof value.representation === "string" &&
      typeof value.colorSpace === "string" &&
      Array.isArray(value.value) &&
      value.value.length === 4 &&
      value.value.every((component) => typeof component === "number" && Number.isFinite(component))
    );
  }
  return false;
}

function isRuntimeAsset(value: unknown): value is RuntimeAsset {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.kind === "string" &&
    typeof value.sizeBytes === "number" &&
    Number.isFinite(value.sizeBytes) &&
    typeof value.runtimeUri === "string"
  );
}

function isRuntimeIoDeviceDescriptor(value: unknown): value is RuntimeIoDeviceDescriptor {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    (value.transportKind === "midi" || value.transportKind === "hid" || value.transportKind === "serial" || value.transportKind === "inline") &&
    Array.isArray(value.directions) &&
    value.directions.every((direction) => direction === "input" || direction === "output") &&
    typeof value.backend === "string" &&
    (value.index === undefined || (typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0)) &&
    typeof value.stable === "boolean"
  );
}

function isRuntimeIoDiagnostic(value: unknown): value is RuntimeIoDiagnostic {
  return (
    isRecord(value) &&
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isRuntimeTelemetrySession(value: unknown): value is RuntimeTelemetrySession {
  return (
    isRecord(value) &&
    typeof value.loaded === "boolean" &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    typeof value.sessionRevision === "number" &&
    typeof value.controlRevision === "number"
  );
}

function isRuntimeTelemetryPreview(value: unknown): value is RuntimeTelemetryPreview {
  return (
    isRecord(value) &&
    isRuntimePreviewState(value.state) &&
    (typeof value.pid === "number" || value.pid === null) &&
    typeof value.stale === "boolean" &&
    (typeof value.graphId === "string" || value.graphId === null) &&
    (typeof value.graphRevision === "string" || value.graphRevision === null) &&
    (typeof value.sessionRevision === "number" || value.sessionRevision === null) &&
    (typeof value.previewSessionRevision === "number" || value.previewSessionRevision === null) &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null)
  );
}

function isRuntimeTelemetryRender(value: unknown): value is RuntimeTelemetryRender {
  return (
    isRecord(value) &&
    typeof value.active === "boolean" &&
    (typeof value.backend === "string" || value.backend === null) &&
    (typeof value.renderer === "string" || value.renderer === null) &&
    typeof value.framesRendered === "number" &&
    (typeof value.approxFps === "number" || value.approxFps === null) &&
    (typeof value.lastFrameMs === "number" || value.lastFrameMs === null) &&
    (typeof value.lastError === "string" || value.lastError === null) &&
    (typeof value.sourceNodeId === "string" || value.sourceNodeId === null) &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isShaderDiagnostic) &&
    typeof value.generatedSourceAvailable === "boolean" &&
    (typeof value.controlRevision === "number" || value.controlRevision === null) &&
    (typeof value.previewControlRevision === "number" || value.previewControlRevision === null) &&
    typeof value.controlLive === "boolean" &&
    (typeof value.lastControlUpdateAt === "string" || value.lastControlUpdateAt === null)
  );
}

function isRuntimeTelemetryProcess(value: unknown): value is RuntimeTelemetryProcess {
  return isRecord(value) && typeof value.runtimeVersion === "string" && typeof value.uptimeMs === "number";
}

function isRuntimeExtensionDescriptor(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.version === "string" &&
    (value.kind === "core-package" || value.kind === "native-runtime" || value.kind === "codec" || value.kind === "node-pack") &&
    typeof value.runtimeAbiVersion === "string" &&
    typeof value.manifestPath === "string" &&
    (value.status === "loaded" || value.status === "disabled" || value.status === "failed") &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every((entry) => typeof entry === "string") &&
    Array.isArray(value.providedNodes) &&
    value.providedNodes.every((entry) => typeof entry === "string") &&
    Array.isArray(value.providedCodecs) &&
    value.providedCodecs.every((entry) => typeof entry === "string") &&
    Array.isArray(value.providedTransports) &&
    value.providedTransports.every((entry) => typeof entry === "string") &&
    Array.isArray(value.providedHelp) &&
    value.providedHelp.every((entry) => typeof entry === "string") &&
    Array.isArray(value.testIds) &&
    value.testIds.every((entry) => typeof entry === "string") &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(isRuntimeDiagnostic)
  );
}

function isGeneratedShaderSourceMap(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.userSourceStartLine === "number" &&
    Number.isInteger(value.userSourceStartLine) &&
    value.userSourceStartLine >= 1 &&
    typeof value.generatedLineOffset === "number" &&
    Number.isInteger(value.generatedLineOffset) &&
    value.generatedLineOffset >= 0
  );
}

function isRuntimeHistoryEntry(value: unknown): value is RuntimeHistoryEntry {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "sequence", "kind", "mutation", "inverseMutation", "subjectEventId", "clientId", "description", "createdAt"]) &&
    isNonEmptyString(value.id) &&
    isNonNegativeInteger(value.sequence) &&
    value.sequence >= 1 &&
    (value.kind === "apply" || value.kind === "undo" || value.kind === "redo") &&
    isRuntimeMutationRequest(value.mutation) &&
    isRuntimeMutationRequest(value.inverseMutation) &&
    (value.subjectEventId === undefined || isNonEmptyString(value.subjectEventId)) &&
    (value.clientId === undefined || isNonEmptyString(value.clientId)) &&
    (value.description === undefined || typeof value.description === "string") &&
    isNonEmptyString(value.createdAt)
  );
}

function isRuntimeMutationRequest(value: unknown): value is RuntimeMutationRequest {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["operation", "viewPatch", "clientId", "description"]) &&
    (value.operation === undefined || isRuntimeOperationEnvelope(value.operation)) &&
    (value.viewPatch === undefined || isRuntimeViewPatch(value.viewPatch)) &&
    (value.clientId === undefined || isNonEmptyString(value.clientId)) &&
    (value.description === undefined || typeof value.description === "string")
  );
}

function isRuntimeViewPatch(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["baseViewRevision", "ops"]) &&
    isNonNegativeInteger(value.baseViewRevision) &&
    Array.isArray(value.ops) &&
    value.ops.every(isRuntimeViewPatchOperation)
  );
}

function isRuntimeViewPatchOperation(value: unknown): boolean {
  if (!isRecord(value) || !isNonEmptyString(value.nodeId)) {
    return false;
  }
  if (value.op === "setNodeView") {
    return hasOnlyKeys(value, ["op", "nodeId", "view"]) && isCanvasNodeView(value.view);
  }
  if (value.op === "moveNodeView") {
    return hasOnlyKeys(value, ["op", "nodeId", "from", "to"]) && (value.from === undefined || isCanvasNodeView(value.from)) && isCanvasNodeView(value.to);
  }
  return false;
}

function isCanvasNodeView(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["x", "y", "width", "height", "collapsed"]) &&
    typeof value.x === "number" &&
    Number.isFinite(value.x) &&
    typeof value.y === "number" &&
    Number.isFinite(value.y) &&
    (value.width === undefined || (typeof value.width === "number" && Number.isFinite(value.width))) &&
    (value.height === undefined || (typeof value.height === "number" && Number.isFinite(value.height))) &&
    (value.collapsed === undefined || typeof value.collapsed === "boolean")
  );
}

function isRuntimeDiagnostic(value: unknown): value is RuntimeDiagnostic {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["severity", "message", "code", "details"]) &&
    typeof value.message === "string" &&
    isRuntimeDiagnosticSeverity(value.severity) &&
    (value.code === undefined || typeof value.code === "string") &&
    (!("details" in value) || isJsonValue(value.details))
  );
}

function isRuntimeDiagnosticSeverity(value: unknown): boolean {
  return value === "error" || value === "warning" || value === "info";
}

function isShaderDiagnostic(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.severity === "string" &&
    SHADER_DIAGNOSTIC_SEVERITIES.has(value.severity) &&
    typeof value.phase === "string" &&
    SHADER_DIAGNOSTIC_PHASES.has(value.phase) &&
    typeof value.code === "string" &&
    typeof value.message === "string" &&
    typeof value.source === "string" &&
    SHADER_DIAGNOSTIC_SOURCES.has(value.source) &&
    optionalPositiveInteger(value.line) &&
    optionalPositiveInteger(value.column) &&
    optionalPositiveInteger(value.endLine) &&
    optionalPositiveInteger(value.endColumn) &&
    (typeof value.uniformId === "string" || value.uniformId === undefined)
  );
}

function isRuntimePreviewState(value: unknown): boolean {
  return value === "stopped" || value === "starting" || value === "running" || value === "exited" || value === "error";
}

function runtimeProfileOwnershipMatches(mode: unknown, ownership: unknown): boolean {
  return (
    (mode === "local-managed" && ownership === "owned-child") ||
    (mode === "local-shared" && ownership === "external") ||
    (mode === "remote" && ownership === "remote")
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function optionalPositiveInteger(value: unknown): boolean {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 1);
}

function isJsonValue(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isRecord(value)) {
    return Object.values(value).every(isJsonValue);
  }
  return false;
}

function isNodeCatalogSnapshot(value: unknown): value is NodeCatalogSnapshotV01 {
  return validateNodeCatalogSnapshotV01(value).ok;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function postRuntimePreviewStatus(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: RuntimePreviewStartRequest
): Promise<RuntimePreviewStatus> {
  return requestJson<RuntimePreviewStatus>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimePreviewStatus
  );
}

async function postRuntimeControlEventResponse(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  body: RuntimeControlEventRequest
): Promise<RuntimeControlEventResponse> {
  return requestJson<RuntimeControlEventResponse>(
    fetchImpl,
    baseUrl,
    path,
    {
      body: JSON.stringify(body),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    },
    isRuntimeControlEventResponse
  );
}

async function requestJson<T>(
  fetchImpl: FetchLike,
  baseUrl: string,
  path: string,
  init: RequestInit,
  guard: (value: unknown) => value is T
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Runtime request failed.";
    throw new RuntimeClientError(`${message} (${path})`);
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new RuntimeClientError(`Runtime returned a non-JSON response from ${path}.`);
  }

  if (!response.ok) {
    throw new RuntimeClientError(`Runtime HTTP ${response.status} from ${path}.`);
  }

  if (!guard(value)) {
    throw new RuntimeClientError(`Runtime returned an unsupported response shape from ${path}.`);
  }

  return value;
}
