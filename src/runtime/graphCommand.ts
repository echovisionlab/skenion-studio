import type {
  CanvasNodeViewV01,
  GraphTargetRef,
  InterfaceIncidentEdgePolicyV01,
  PasteGraphFragmentRequest
} from "@skenion/contracts";

const DEFAULT_RUNTIME_SESSION_ID = "default";
const DEFAULT_RUNTIME_URL = "http://localhost:3761";

export class RuntimeGraphCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuntimeGraphCommandError";
  }
}

export type RuntimeGraphCommandKind =
  | "node.resolve"
  | "node.create"
  | "node.replace"
  | "view.patch"
  | "graph.pasteFragment"
  | "history.undo"
  | "history.redo"
  | "graph.changeSet"
  | "node.input";

export interface RuntimeGraphCommandPayload {
  kind: RuntimeGraphCommandKind;
  baseSessionRevision?: number;
  baseGraphRevision?: string;
  baseViewRevision?: number;
  target?: GraphTargetRef;
  surfacePath?: unknown;
  viewPatch?: RuntimeGraphCommandViewPatch;
  changes?: unknown[];
  objectSpec?: string;
  nodeId?: string;
  requestedNodeId?: string;
  view?: CanvasNodeViewV01;
  params?: Record<string, unknown>;
  portId?: string;
  message?: unknown;
  request?: PasteGraphFragmentRequest;
  scope?: "client" | "global";
  unresolvedPolicy?: "reject" | "materialize-issue";
  interfaceIncidentEdgePolicy?: InterfaceIncidentEdgePolicyV01;
  description?: string;
}

export interface RuntimeGraphCommandViewPatch {
  baseViewRevision: number;
  ops: unknown[];
}

export interface RuntimeGraphCommandIssue {
  severity: "error" | "warning" | "info" | string;
  code: string;
  message: string;
  details?: unknown;
}

export interface RuntimeGraphCommandAckPayload {
  accepted: boolean;
  applied: boolean;
  conflict: boolean;
  status: "accepted" | "conflict" | "rejected" | string;
  kind: RuntimeGraphCommandKind | string;
  cached?: boolean;
  graphSequence?: number;
  commandId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  eventCursor?: string;
  target?: GraphTargetRef;
  surfacePath?: unknown;
  baseSessionRevision?: number;
  baseGraphRevision?: string;
  baseViewRevision?: number;
  graphRevision?: string;
  viewRevision?: number;
  sessionRevision?: number;
  historySummary?: RuntimeGraphCommandHistorySummary;
  issues: RuntimeGraphCommandIssue[];
  node?: unknown;
  operation?: unknown;
}

export interface RuntimeGraphCommandHistorySummary {
  latestEntryId?: string | null;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export interface RuntimeRealtimeEnvelope {
  schema: "skenion.runtime.realtime";
  schemaVersion: "0.1.0";
  type: string;
  messageId: string;
  sessionId: string;
  connectionId?: string;
  clientId?: string;
  windowId?: string;
  commandId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  sequence?: number;
  cursor?: string;
  createdAt?: string;
  payload: unknown;
}

export interface RuntimeGraphCommandResponse {
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  issues: RuntimeGraphCommandIssue[];
  payload: RuntimeGraphCommandAckPayload;
  ack: RuntimeRealtimeEnvelope;
}

export interface RuntimeGraphCommandClient {
  sendGraphCommand: (
    payload: RuntimeGraphCommandPayload,
    options?: RuntimeGraphCommandSendOptions
  ) => Promise<RuntimeGraphCommandResponse>;
}

export interface RuntimeGraphCommandSendOptions {
  commandId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export interface RuntimeGraphCommandClientOptions {
  baseUrl?: string;
  clientId?: string;
  sessionId?: string | null;
  windowId?: string;
  WebSocketImpl?: RuntimeWebSocketConstructor;
}

export interface RuntimeWebSocketConstructor {
  new (url: string): RuntimeWebSocket;
}

export interface RuntimeWebSocket {
  close: () => void;
  send: (data: string) => void;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: ((event: unknown) => void) | null;
}

const DEFAULT_TIMEOUT_MS = 5000;
const REALTIME_SCHEMA = "skenion.runtime.realtime";
const REALTIME_SCHEMA_VERSION = "0.1.0";

let commandSequence = 0;

export function createRuntimeGraphCommandClient(
  options: RuntimeGraphCommandClientOptions = {}
): RuntimeGraphCommandClient {
  const baseUrl = normalizeRuntimeUrl(options.baseUrl ?? DEFAULT_RUNTIME_URL);
  const sessionId = options.sessionId?.trim() || DEFAULT_RUNTIME_SESSION_ID;
  const WebSocketImpl = (options.WebSocketImpl ?? globalThis.WebSocket) as RuntimeWebSocketConstructor | undefined;

  if (!WebSocketImpl) {
    throw new RuntimeGraphCommandError("Runtime realtime WebSocket is unavailable.");
  }

  return {
    sendGraphCommand: (payload, sendOptions = {}) =>
      sendRuntimeGraphCommand(WebSocketImpl, baseUrl, sessionId, payload, {
        clientId: options.clientId ?? "studio",
        commandId: sendOptions.commandId,
        idempotencyKey: sendOptions.idempotencyKey,
        timeoutMs: sendOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        windowId: options.windowId ?? "studio"
      })
  };
}

export function runtimeRealtimeWebSocketUrl(url: string = DEFAULT_RUNTIME_URL, sessionId?: string | null): string {
  const runtimeUrl = new URL(normalizeRuntimeUrl(url));
  if (runtimeUrl.protocol === "http:") {
    runtimeUrl.protocol = "ws:";
  } else if (runtimeUrl.protocol === "https:") {
    runtimeUrl.protocol = "wss:";
  } else if (runtimeUrl.protocol !== "ws:" && runtimeUrl.protocol !== "wss:") {
    throw new RuntimeGraphCommandError(`Unsupported Runtime realtime URL protocol ${runtimeUrl.protocol}.`);
  }
  runtimeUrl.pathname = runtimeSessionPath(sessionId);
  runtimeUrl.search = "";
  runtimeUrl.hash = "";
  return runtimeUrl.toString();
}

function normalizeRuntimeUrl(url: string): string {
  return url.trim().replace(/\/+$/u, "");
}

function runtimeSessionPath(sessionId?: string | null, suffix = ""): string {
  const normalizedSessionId = encodeURIComponent(sessionId?.trim() || DEFAULT_RUNTIME_SESSION_ID);
  return `/v0/sessions/${normalizedSessionId}${suffix}`;
}

async function sendRuntimeGraphCommand(
  WebSocketImpl: RuntimeWebSocketConstructor,
  baseUrl: string,
  sessionId: string,
  payload: RuntimeGraphCommandPayload,
  options: Required<Pick<RuntimeGraphCommandSendOptions, "timeoutMs">> &
    Pick<RuntimeGraphCommandSendOptions, "commandId" | "idempotencyKey"> & {
      clientId: string;
      windowId: string;
    }
): Promise<RuntimeGraphCommandResponse> {
  const socket = new WebSocketImpl(runtimeRealtimeWebSocketUrl(baseUrl, sessionId));
  const frames: RuntimeRealtimeEnvelope[] = [];
  let pending: (() => void) | null = null;
  let opened = false;
  let socketError: string | null = null;
  let closed = false;

  socket.onopen = () => {
    opened = true;
    pending?.();
  };
  socket.onerror = () => {
    socketError = "Runtime realtime WebSocket failed.";
    pending?.();
  };
  socket.onclose = () => {
    closed = true;
    pending?.();
  };
  socket.onmessage = (event) => {
    try {
      const frame = parseRealtimeFrame(event.data);
      frames.push(frame);
    } catch (error) {
      socketError = error instanceof Error ? error.message : "Runtime realtime returned an invalid frame.";
    }
    pending?.();
  };

  try {
    await waitForSocketProgress(options.timeoutMs, () => socketError !== null || closed || opened, (resolve) => {
      pending = resolve;
    });
    if (socketError) {
      throw new RuntimeGraphCommandError(socketError);
    }
    if (closed) {
      throw new RuntimeGraphCommandError("Runtime realtime WebSocket closed before it opened.");
    }

    const helloId = nextRealtimeMessageId("hello");
    socket.send(JSON.stringify(createRealtimeEnvelope("session.hello", sessionId, helloId, {
      clientId: options.clientId,
      hints: { label: "Skenion Studio" },
      windowId: options.windowId
    })));
    const socketFailure = () => socketError ?? (closed ? "Runtime realtime WebSocket closed before graph command completed." : null);

    await waitForRealtimeFrame(frames, "session.attached", options.timeoutMs, (resolve) => {
      pending = resolve;
    }, undefined, socketFailure);

    const commandId = options.commandId ?? nextRealtimeMessageId(payload.kind.replace(".", "-"));
    socket.send(JSON.stringify(createRealtimeEnvelope("graph.command", sessionId, commandId, payload, {
      commandId,
      correlationId: commandId,
      idempotencyKey: options.idempotencyKey ?? commandId
    })));
    const ack = await waitForRealtimeFrame(frames, "graph.ack", options.timeoutMs, (resolve) => {
      pending = resolve;
    }, commandId, socketFailure);

    return graphCommandResponseFromAck(ack);
  } finally {
    pending = null;
    socket.close();
  }
}

function createRealtimeEnvelope(
  type: string,
  sessionId: string,
  messageId: string,
  payload: unknown,
  options: Partial<Pick<RuntimeRealtimeEnvelope, "commandId" | "correlationId" | "idempotencyKey">> = {}
): RuntimeRealtimeEnvelope {
  return {
    schema: REALTIME_SCHEMA,
    schemaVersion: REALTIME_SCHEMA_VERSION,
    type,
    messageId,
    sessionId,
    ...options,
    payload
  };
}

async function waitForRealtimeFrame(
  frames: RuntimeRealtimeEnvelope[],
  type: string,
  timeoutMs: number,
  setPending: (resolve: (() => void) | null) => void,
  commandId?: string,
  socketFailure?: () => string | null
): Promise<RuntimeRealtimeEnvelope> {
  let matchedFrame: RuntimeRealtimeEnvelope | undefined;
  await waitForSocketProgress(timeoutMs, () => {
    const socketFailureMessage = socketFailure?.();
    if (socketFailureMessage) {
      throw new RuntimeGraphCommandError(socketFailureMessage);
    }
    const runtimeError = frames.find((frame) => frame.type === "runtime.error");
    if (runtimeError) {
      throw realtimeError(runtimeError);
    }
    matchedFrame = frames.find((frame) => frame.type === type && (!commandId || frame.commandId === commandId));
    return matchedFrame !== undefined;
  }, setPending);
  return matchedFrame!;
}

function waitForSocketProgress(
  timeoutMs: number,
  condition: () => boolean,
  setPending: (resolve: (() => void) | null) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      setPending(null);
      reject(new RuntimeGraphCommandError("Runtime realtime request timed out."));
    }, timeoutMs);

    const check = () => {
      try {
        if (!condition()) {
          setPending(check);
          return;
        }
      } catch (error) {
        globalThis.clearTimeout(timeoutId);
        reject(error);
        return;
      }
      globalThis.clearTimeout(timeoutId);
      resolve();
    };

    check();
  });
}

function graphCommandResponseFromAck(ack: RuntimeRealtimeEnvelope): RuntimeGraphCommandResponse {
  if (!isRecord(ack.payload)) {
    throw new RuntimeGraphCommandError("Runtime graph ACK returned an unsupported payload.");
  }

  const payload = ack.payload;
  const issues = Array.isArray(payload.issues)
    ? payload.issues.filter(isRuntimeIssueLike)
    : [];
  const responsePayload: RuntimeGraphCommandAckPayload = {
    accepted: payload.accepted === true,
    applied: payload.applied === true,
    conflict: payload.conflict === true,
    status: typeof payload.status === "string" ? payload.status : "rejected",
    kind: typeof payload.kind === "string" ? payload.kind : "graph.command",
    cached: typeof payload.cached === "boolean" ? payload.cached : undefined,
    graphSequence: numberField(payload.graphSequence),
    commandId: stringField(payload.commandId),
    correlationId: stringField(payload.correlationId),
    idempotencyKey: stringField(payload.idempotencyKey),
    eventCursor: stringField(payload.eventCursor),
    target: isRecord(payload.target) ? payload.target as unknown as GraphTargetRef : undefined,
    surfacePath: payload.surfacePath,
    baseSessionRevision: numberField(payload.baseSessionRevision),
    baseGraphRevision: stringField(payload.baseGraphRevision),
    baseViewRevision: numberField(payload.baseViewRevision),
    graphRevision: stringField(payload.graphRevision),
    viewRevision: numberField(payload.viewRevision),
    sessionRevision: numberField(payload.sessionRevision),
    historySummary: graphCommandHistorySummary(payload.historySummary),
    issues,
    node: payload.node,
    operation: payload.operation
  };

  return {
    ok: responsePayload.accepted,
    applied: responsePayload.applied,
    conflict: responsePayload.conflict,
    issues,
    payload: responsePayload,
    ack
  };
}

function parseRealtimeFrame(data: unknown): RuntimeRealtimeEnvelope {
  const value = typeof data === "string" ? JSON.parse(data) : data;
  if (!isRecord(value) || value.schema !== REALTIME_SCHEMA || value.schemaVersion !== REALTIME_SCHEMA_VERSION) {
    throw new RuntimeGraphCommandError("Runtime realtime returned an unsupported frame.");
  }
  if (typeof value.type !== "string" || typeof value.messageId !== "string" || typeof value.sessionId !== "string") {
    throw new RuntimeGraphCommandError("Runtime realtime returned an incomplete frame.");
  }
  return value as unknown as RuntimeRealtimeEnvelope;
}

function realtimeError(frame: RuntimeRealtimeEnvelope): RuntimeGraphCommandError {
  const issue = isRecord(frame.payload) && isRecord(frame.payload.issue)
    ? frame.payload.issue
    : null;
  const message = typeof issue?.message === "string"
    ? issue.message
    : "Runtime realtime returned an error.";
  return new RuntimeGraphCommandError(message);
}

function graphCommandHistorySummary(value: unknown): RuntimeGraphCommandHistorySummary | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  return {
    latestEntryId: stringField(value.latestEntryId) ?? null,
    canUndo: value.canUndo === true,
    canRedo: value.canRedo === true,
    undoDepth: numberField(value.undoDepth) ?? 0,
    redoDepth: numberField(value.redoDepth) ?? 0
  };
}

function isRuntimeIssueLike(value: unknown): value is RuntimeGraphCommandIssue {
  return (
    isRecord(value) &&
    typeof value.severity === "string" &&
    typeof value.code === "string" &&
    typeof value.message === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function numberField(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nextRealtimeMessageId(prefix: string): string {
  commandSequence += 1;
  return `studio-${prefix}-${Date.now()}-${commandSequence}`;
}
