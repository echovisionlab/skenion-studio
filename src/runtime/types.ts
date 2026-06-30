import type {
  CanvasNodeViewV01,
  ColorRepresentationV01,
  EdgeSpecV01,
  FloatRepresentationV01,
  GeneratedShaderSourceMapV01,
  GraphDocumentV01,
  GraphFragmentV01,
  GraphNodeV01,
  GraphTargetRef,
  InterfaceDiagnosticDetailV01,
  InterfaceIncidentEdgePolicyV01,
  IntRepresentationV01,
  PatchDefinitionV01,
  PortSpecV01,
  ProjectDocumentV01,
  ShaderDiagnosticV01,
  UintRepresentationV01
} from "@skenion/contracts";
import type { RuntimeGraphCommandResponse } from "./graphCommand";

export type {
  ClockFieldV01,
  ClockStateV01,
  ClockTimeSignatureV01,
  ExtensionManifestV01,
  NodeCatalogSnapshotV01
} from "@skenion/contracts";

export type RuntimeIoDiagnosticSeverity = "warning" | "error";

export interface RuntimeIoDiagnostic {
  severity: RuntimeIoDiagnosticSeverity;
  code: string;
  message: string;
}

export type RuntimeIoTransportKind = "midi" | "hid" | "serial" | "inline";

export type RuntimeIoDirection = "input" | "output";

export interface RuntimeIoDeviceDescriptor {
  id: string;
  name: string;
  transportKind: RuntimeIoTransportKind;
  directions: RuntimeIoDirection[];
  backend: string;
  index?: number;
  stable: boolean;
}

export interface RuntimeIoDeviceListResponse {
  ok: boolean;
  devices: RuntimeIoDeviceDescriptor[];
  diagnostics: RuntimeIoDiagnostic[];
}

export interface RuntimeIoInlineFrame {
  atNs: number;
  bytes: number[];
}

export type RuntimeIoBindingConfig =
  | {
      kind: "midi";
      deviceId: string;
    }
  | {
      kind: "hid";
      deviceId: string;
    }
  | {
      kind: "serial";
      deviceId: string;
      baudRate?: number;
    }
  | {
      kind: "inline";
      frames: RuntimeIoInlineFrame[];
    };

export type RuntimeDiagnosticSeverity = "error" | "warning" | "info";

type RuntimeDiagnosticDetails =
  | string
  | number
  | boolean
  | null
  | RuntimeDiagnosticDetails[]
  | { [key: string]: RuntimeDiagnosticDetails };

export interface RuntimeDiagnostic {
  severity: RuntimeDiagnosticSeverity;
  message: string;
  code?: string;
  details?: RuntimeDiagnosticDetails;
}

export interface RuntimeHealth {
  ok: boolean;
  service: string;
  version: string;
}

export interface RuntimeInfo {
  name: string;
  version: string;
  apiVersion: string;
  capabilities: string[];
}

export type RuntimeSessionLifecycleState = "initializing" | "ready" | "closing" | "closed" | "error";

export type RuntimeConnectionProfileMode = "local-managed" | "local-shared" | "remote";

export type RuntimeOwnershipMode = "owned-child" | "external" | "remote";

export interface RuntimeEndpointMetadata {
  url: string;
  canonicalUrl?: string;
  protocol: "http" | "https";
  host?: string;
  port?: number;
  tls?: boolean;
}

export interface RuntimeProcessMetadata {
  ownedByHost: boolean;
  pid?: number;
  executablePath?: string;
  workingDirectory?: string;
  startedAt?: string;
  ownerWindowId?: string;
  platform?: string;
  arch?: string;
}

interface RuntimeConnectionProfileBase {
  displayName?: string;
  endpoint: RuntimeEndpointMetadata;
  process?: RuntimeProcessMetadata | null;
}

export type RuntimeConnectionProfile =
  | (RuntimeConnectionProfileBase & {
      mode: "local-managed";
      ownership: "owned-child";
    })
  | (RuntimeConnectionProfileBase & {
      mode: "local-shared";
      ownership: "external";
    })
  | (RuntimeConnectionProfileBase & {
      mode: "remote";
      ownership: "remote";
    });

export interface RuntimeEventReplayWindow {
  cursorKind: "sequence";
  currentCursor: string;
  earliestSequence: number;
  latestSequence: number;
  replayLimit: number | null;
  overflow?: boolean;
}

export interface RuntimeSessionCapabilitySet {
  sessionAddressing: boolean;
  eventReplay: boolean;
  multiWindow: boolean;
  profiles: RuntimeConnectionProfileMode[];
  authPolicy: "deferred";
}

export interface RuntimeLogEvent {
  id: number;
  timestamp: string;
  source: "runtime";
  level: RuntimeDiagnosticSeverity;
  code: string | null;
  message: string;
}

export interface RuntimeLogRetention {
  replayLimit: number;
  replayLevels: RuntimeDiagnosticSeverity[];
}

export interface RuntimeLogSnapshotResponse {
  schema: "skenion.runtime.logs";
  schemaVersion: string;
  ok: boolean;
  events: RuntimeLogEvent[];
  retention: RuntimeLogRetention;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeGraphPort = PortSpecV01;

export type RuntimeGraphNode = GraphNodeV01;

export type RuntimeGraphEdge = EdgeSpecV01;

export type RuntimeGraphDocument = GraphDocumentV01;

export type RuntimeGraphFragment = GraphFragmentV01;

export interface RuntimeViewStateDocument {
  schema: "skenion.view-state";
  schemaVersion: "0.1.0";
  canvas: {
    nodes: Record<string, CanvasNodeViewV01>;
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
}

export type RuntimePatchLibraryEntry = PatchDefinitionV01;

export type RuntimeProjectDocument = ProjectDocumentV01;

export type RuntimeProjectSnapshot = RuntimeProjectDocument;

export type RuntimeProjectRequest = RuntimeProjectDocument;

export interface RuntimePlan {
  graphId: string;
  graphRevision: string;
  nodes: RuntimePlanNode[];
  edges: RuntimePlanEdge[];
  groups: RuntimeExecutionGroup[];
}

export interface RuntimePlanNode {
  nodeId: string;
  kind: string;
  kindVersion: string;
  executionModel: string;
  order: number;
}

export interface RuntimePlanEdge {
  fromNode: string;
  fromPort: string;
  toNode: string;
  toPort: string;
  metadata?: RuntimePlanEdgeMetadata | null;
}

export interface RuntimePlanEdgeMetadata {
  resolvedType?: string | null;
  mergePolicy?: string | null;
  fanOutPolicy?: string | null;
  order?: number | null;
  feedback?: {
    boundary: string;
    bufferMode?: string;
    maxLatencyFrames?: number;
  } | null;
  cycleClassification?: string | null;
}

export interface RuntimeExecutionGroup {
  executionModel: string;
  nodeIds: string[];
}

export interface RuntimeDummyExecutionReport {
  graphId: string;
  graphRevision: string;
  frameCount: number;
  frames: RuntimeDummyFrameReport[];
}

export interface RuntimeDummyFrameReport {
  index: number;
  executedNodes: RuntimeDummyNodeExecution[];
}

export interface RuntimeDummyNodeExecution {
  nodeId: string;
  kind: string;
  kindVersion: string;
  executionModel: string;
  order: number;
  status: string;
}

export interface RuntimeApiResponse {
  ok: boolean;
  diagnostics: RuntimeDiagnostic[];
  plan: RuntimePlan | null;
  report: RuntimeDummyExecutionReport | null;
}

export interface RuntimeSessionSnapshot {
  sessionRevision: number;
  viewRevision: number;
  controlRevision: number;
  project: RuntimeProjectSnapshot | null;
  diagnostics: RuntimeDiagnostic[];
  plan: Record<string, unknown> | null;
}

export interface RuntimeSessionResponse {
  ok: boolean;
  snapshot: RuntimeSessionSnapshot;
  diagnostics: RuntimeDiagnostic[];
  report: RuntimeDummyExecutionReport | null;
}

export interface RuntimeSessionInfoResponse {
  schema: "skenion.runtime.session.info";
  schemaVersion: "0.1.0";
  ok: boolean;
  sessionId: string;
  lifecycle: RuntimeSessionLifecycleState;
  snapshot: RuntimeSessionSnapshot;
  profile: RuntimeConnectionProfile;
  capabilities: RuntimeSessionCapabilitySet;
  eventReplay: RuntimeEventReplayWindow;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeOperationAttribution {
  actorId?: string;
  clientId?: string;
  label?: string;
}

export interface PasteGraphFragmentRequest {
  target: GraphTargetRef;
  fragment: RuntimeGraphFragment;
  placement?: Record<string, unknown>;
  options?: Record<string, unknown>;
}

export interface RuntimeOperationEnvelope {
  schema: "skenion.runtime.operation";
  schemaVersion: "0.1.0";
  id: string;
  kind: "pasteGraphFragment";
  request: PasteGraphFragmentRequest;
  attribution?: RuntimeOperationAttribution;
  correlationId?: string;
  createdAt?: string;
}

export interface RuntimeMutationRequest {
  operation?: RuntimeOperationEnvelope;
  viewPatch?: RuntimeViewPatch;
  clientId?: string;
  description?: string;
}

export interface RuntimeViewPatch {
  baseViewRevision: number;
  ops: RuntimeViewPatchOperation[];
}

export type RuntimeViewPatchOperation =
  | {
      op: "setNodeView";
      nodeId: string;
      view: CanvasNodeViewV01;
    }
  | {
      op: "moveNodeView";
      nodeId: string;
      from?: CanvasNodeViewV01;
      to: CanvasNodeViewV01;
    };

export type RuntimeHistoryEntryKind = "apply" | "undo" | "redo";

export interface RuntimeHistoryEntry {
  id: string;
  sequence: number;
  kind: RuntimeHistoryEntryKind;
  mutation: RuntimeMutationRequest;
  inverseMutation: RuntimeMutationRequest;
  subjectEventId?: string;
  clientId?: string;
  description?: string;
  createdAt: string;
}

export interface RuntimeHistory {
  schema: "skenion.runtime.history";
  schemaVersion: "0.1.0";
  entries: RuntimeHistoryEntry[];
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

export interface RuntimeMutationResponse {
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  snapshot: RuntimeSessionSnapshot;
  history: RuntimeHistory;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeSessionEventKind = "snapshot" | "load" | "clear" | "mutate" | "undo" | "redo";

export interface RuntimeEventReplayGap {
  expectedSequence: number;
  actualSequence: number;
  reason: "retention-overflow" | "stream-reset" | "unknown";
}

export interface RuntimeEventReplayMetadata {
  cursor: string;
  previousCursor: string | null;
  replayed: boolean;
  gap: RuntimeEventReplayGap | null;
  overflow: boolean;
}

export interface RuntimeSessionEvent {
  schema: "skenion.runtime.session.event";
  schemaVersion: "0.1.0";
  id: string;
  sessionId: string;
  sequence: number;
  sessionRevision: number;
  kind: RuntimeSessionEventKind;
  snapshot: RuntimeSessionSnapshot;
  history: RuntimeHistory;
  mutation?: RuntimeHistoryEntry;
  replay: RuntimeEventReplayMetadata;
  diagnostics: RuntimeDiagnostic[];
  createdAt: string;
}

export type RuntimePreviewState = "stopped" | "starting" | "running" | "exited" | "error";

export interface RuntimePreviewStatus {
  ok: boolean;
  state: RuntimePreviewState;
  pid: number | null;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number | null;
  previewSessionRevision: number | null;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
  stale: boolean;
  startedAt: string | null;
  exitedAt: string | null;
  exitCode: number | null;
  message: string | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimePreviewStartRequest {
  restart: boolean;
}

export interface RuntimeAsset {
  id: string;
  name: string;
  mimeType: string;
  kind: string;
  sizeBytes: number;
  runtimeUri: string;
}

export interface RuntimeAssetImportResponse {
  ok: boolean;
  asset: RuntimeAsset | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeAssetListResponse {
  ok: boolean;
  assets: RuntimeAsset[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeAssetGetResponse {
  ok: boolean;
  asset: RuntimeAsset | null;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeControlValue =
  | {
      type: "float";
      representation: FloatRepresentationV01;
      value: number;
    }
  | {
      type: "int";
      representation: IntRepresentationV01;
      value: number;
    }
  | {
      type: "uint";
      representation: UintRepresentationV01;
      value: number;
    }
  | {
      type: "bool";
      value: boolean;
    }
  | {
      type: "string";
      value: string;
    }
  | {
      type: "color";
      representation: ColorRepresentationV01;
      colorSpace: "linear" | "srgb";
      value: [number, number, number, number];
    };

export type RuntimeControlAtom = RuntimeControlValue;

export interface RuntimeControlMessage {
  selector: string;
  atoms: RuntimeControlAtom[];
}

export interface RuntimeControlEventRequest {
  nodeId: string;
  portId: "in" | "cold" | "value" | "out";
  message: RuntimeControlMessage;
}

export interface RuntimeControlEmission {
  nodeId: string;
  portId: "in" | "out" | "value";
  message: RuntimeControlMessage;
}

export interface RuntimeControlEventResponse {
  ok: boolean;
  changed: boolean;
  controlRevision: number | null;
  emitted: RuntimeControlEmission[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeControlStateResponse {
  ok: boolean;
  controlRevision: number;
  values: Record<string, RuntimeControlValue>;
  channels: Record<string, RuntimeControlMessage>;
  diagnostics: RuntimeDiagnostic[];
}

export type RuntimeControlReadTarget = "param" | "port" | "state";

export interface RuntimeControlReadRequest {
  nodeId: string;
  target: RuntimeControlReadTarget;
  id: string;
}

export type RuntimeControlReadValue =
  | RuntimeControlValue
  | {
      type: "json";
      value: unknown;
    };

export interface RuntimeControlReadResponse {
  ok: boolean;
  address: RuntimeControlReadRequest;
  value: RuntimeControlReadValue | null;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeTelemetrySnapshot {
  schema: "skenion.runtime.telemetry";
  schemaVersion: "0.1.0";
  ok: boolean;
  timestamp: string;
  session: RuntimeTelemetrySession;
  preview: RuntimeTelemetryPreview;
  render: RuntimeTelemetryRender;
  process: RuntimeTelemetryProcess;
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeTelemetrySession {
  loaded: boolean;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number;
  controlRevision: number;
}

export interface RuntimeTelemetryPreview {
  state: RuntimePreviewState;
  pid: number | null;
  stale: boolean;
  graphId: string | null;
  graphRevision: string | null;
  sessionRevision: number | null;
  previewSessionRevision: number | null;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
}

export interface RuntimeTelemetryRender {
  active: boolean;
  backend: string | null;
  renderer: string | null;
  framesRendered: number;
  approxFps: number | null;
  lastFrameMs: number | null;
  lastError: string | null;
  sourceNodeId: string | null;
  diagnostics: ShaderDiagnosticV01[];
  generatedSourceAvailable: boolean;
  controlRevision: number | null;
  previewControlRevision: number | null;
  controlLive: boolean;
  lastControlUpdateAt: string | null;
}

export interface RuntimeTelemetryProcess {
  runtimeVersion: string;
  uptimeMs: number;
}

export interface RuntimeGeneratedShaderResponse {
  ok: boolean;
  nodeId: string | null;
  language: "wgsl" | null;
  source: string | null;
  sourceMap: GeneratedShaderSourceMapV01 | null;
  diagnostics: ShaderDiagnosticV01[];
}

export interface RuntimeSessionRunRequest {
  frames: number;
}

export type RuntimeExtensionStatus = "loaded" | "disabled" | "failed";

export interface RuntimeExtensionDescriptor {
  id: string;
  version: string;
  kind: "core-package" | "native-runtime" | "codec" | "node-pack";
  runtimeAbiVersion: string;
  manifestPath: string;
  status: RuntimeExtensionStatus;
  capabilities: string[];
  providedNodes: string[];
  providedCodecs: string[];
  providedTransports: string[];
  providedHelp: string[];
  testIds: string[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeExtensionListResponse {
  ok: boolean;
  extensions: RuntimeExtensionDescriptor[];
  diagnostics: RuntimeDiagnostic[];
}

export interface RuntimeOperationDiagnostic {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
  path?: string;
  target?: GraphTargetRef;
  expectedRevision?: string;
  actualRevision?: string;
  duplicates?: string[];
  nodes?: string[];
  edges?: string[];
  interfacePolicy?: InterfaceIncidentEdgePolicyV01;
  interfaceDetail?: InterfaceDiagnosticDetailV01;
}

export interface IdRemapResult {
  nodeIdMap: Record<string, string>;
  edgeIdMap: Record<string, string>;
  omittedEdgeIds: string[];
}

export interface PasteGraphFragmentResponse {
  schema: "skenion.runtime.paste-graph-fragment.response";
  schemaVersion: "0.1.0";
  ok: boolean;
  applied: boolean;
  conflict: boolean;
  target: GraphTargetRef;
  revisionBefore: string;
  revisionAfter: string | null;
  historyEntryId: string | null;
  idRemap: IdRemapResult;
  diagnostics: RuntimeOperationDiagnostic[];
}

export type RuntimePatchResponse = RuntimeMutationResponse;

export type RuntimeConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type RuntimeProjectPayload = RuntimeProjectRequest;

export type RuntimeResultKind =
  | "validate"
  | "plan"
  | "run"
  | "session"
  | "loadSession"
  | "validateSession"
  | "planSession"
  | "runSession"
  | "mutateSession"
  | "graphCommand"
  | "sessionOperation"
  | "undoPatch"
  | "redoPatch"
  | "controlEvent"
  | "clearSession";

export type RuntimeActionResponse =
  | RuntimeApiResponse
  | RuntimePatchResponse
  | RuntimeGraphCommandResponse
  | RuntimeSessionResponse
  | PasteGraphFragmentResponse
  | RuntimeControlEventResponse
  | RuntimeControlReadResponse;

export interface RuntimeActionResult {
  kind: RuntimeResultKind;
  response: RuntimeActionResponse;
  receivedAt: string;
}
