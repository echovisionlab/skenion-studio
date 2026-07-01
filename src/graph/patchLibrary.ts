import type {
  DataFlow,
  DataTypeV01,
  EdgeSpecV01,
  FeedbackPolicyV01,
  GraphDocumentV01,
  GraphNodeV01 as ContractGraphNodeV01,
  ObjectImplementationRefV01,
  PatchContractPortV01,
  PatchDefinitionV01,
  PortGroupSpecV01,
  PortSpecV01,
  PortV01
} from "@skenion/contracts";
import { derivePatchContractV01 } from "@skenion/contracts";

export const CURRENT_CONTRACT_SCHEMA_VERSION = "0.1.0" as const;
export const SUBPATCH_NODE_KIND = "core.subpatch" as const;

export type { PatchDefinitionV01 };

export interface DisplayEdgeV01 {
  from: { node: string; port: string };
  to: { node: string; port: string };
  id?: string;
  resolvedType?: string;
  order?: number;
  enabled?: boolean;
  adapter?: string;
  feedback?: FeedbackPolicyV01;
  styleOverride?: string;
  label?: string;
  description?: string;
}

export interface DisplayGraphNodeV01 extends Omit<ContractGraphNodeV01, "kind" | "kindVersion" | "ports"> {
  kind: string;
  kindVersion: string;
  ports: PortV01[];
  portGroups?: PortGroupSpecV01[];
}

export interface DisplayGraphDocumentV01 extends Omit<GraphDocumentV01, "edges" | "nodes"> {
  nodes: DisplayGraphNodeV01[];
  edges: DisplayEdgeV01[];
}

export interface PatchLibrary {
  patches: PatchDefinitionV01[];
}

type PortSpecDisplayExtras = Pick<
  PortSpecV01,
  | "accepts"
  | "defaultValue"
  | "description"
  | "fanOutPolicy"
  | "group"
  | "latch"
  | "maxConnections"
  | "messageKeys"
  | "mergePolicy"
  | "minConnections"
  | "rate"
  | "styleKey"
  | "triggerMode"
>;

export function createPatchLibrary(patches: PatchDefinitionV01[] = []): PatchLibrary {
  return { patches };
}

export function isPatchDefinition(value: unknown): value is PatchDefinitionV01 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PatchDefinitionV01>;
  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.revision === "string" &&
    candidate.revision.length > 0 &&
    Boolean(candidate.graph) &&
    candidate.graph?.schema === "skenion.graph" &&
    candidate.graph?.schemaVersion === CURRENT_CONTRACT_SCHEMA_VERSION
  );
}

export function findPatchDefinition(
  library: PatchLibrary | undefined,
  patchId: string
): PatchDefinitionV01 | null {
  return library?.patches.find((patch) => patch.id === patchId) ?? null;
}

export function patchDisplayName(definition: PatchDefinitionV01): string {
  return metadataString(definition.metadata?.title) ?? definition.id;
}

export function patchDescription(definition: PatchDefinitionV01): string {
  return metadataString(definition.metadata?.description) ?? "";
}

export function patchTags(definition: PatchDefinitionV01): string[] {
  const tags = definition.metadata?.["tags"];
  return Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
}

export function patchDefinitionBoundaryPorts(definition: PatchDefinitionV01): PatchContractPortV01[] {
  const derived = derivePatchContractV01(definition).ports;
  return derived.length > 0 ? derived : legacyDisplayPatchBoundaryPorts(definition);
}

export function createSubpatchNodeFromDefinition(
  definition: PatchDefinitionV01,
  existingNodes: DisplayGraphNodeV01[],
  options: { nodeId?: string; objectSpec?: string } = {}
): DisplayGraphNodeV01 {
  const objectSpec = options.objectSpec ?? `p ${definition.id}`;
  const description = patchDescription(definition).trim();
  const implementation = {
    provider: {
      kind: "projectPatch",
      patchId: definition.id,
      revision: definition.revision
    },
    objectId: definition.id,
    version: definition.revision
  } satisfies ObjectImplementationRefV01;

  return {
    id: options.nodeId ?? uniqueSubpatchNodeId(definition.id, existingNodes),
    kind: SUBPATCH_NODE_KIND,
    kindVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    objectSpec,
    implementation,
    objectResolution: {
      status: "resolved",
      selectedSpec: objectSpec,
      candidates: [
        {
          implementation,
          objectSpec,
          displayName: patchDisplayName(definition),
          reason: "project-patch"
        }
      ]
    },
    params: {
      label: objectSpec,
      patchId: definition.id,
      patchRevision: definition.revision,
      ...(description ? { description } : {})
    },
    ports: patchDefinitionBoundaryPorts(definition).map(portSpecToGraphPort)
  };
}

function legacyDisplayPatchBoundaryPorts(definition: PatchDefinitionV01): PatchContractPortV01[] {
  return definition.graph.nodes.flatMap((node) => {
    const legacyNode = node as ContractGraphNodeV01 & { kind?: string; params?: Record<string, unknown> };
    if (legacyNode.kind === "core.inlet" || legacyNode.kind === "object.core.inlet") {
      return legacyBoundaryPortsForNode(legacyNode, "output", "input");
    }
    if (legacyNode.kind === "core.outlet" || legacyNode.kind === "object.core.outlet") {
      return legacyBoundaryPortsForNode(legacyNode, "input", "output");
    }
    return [];
  });
}

function legacyBoundaryPortsForNode(
  node: ContractGraphNodeV01 & { params?: Record<string, unknown> },
  sourceDirection: PortSpecV01["direction"],
  boundaryDirection: PortSpecV01["direction"]
): PatchContractPortV01[] {
  const sourcePorts = node.ports.filter((port) => port.direction === sourceDirection);
  if (sourcePorts.length === 0) {
    return [];
  }

  return sourcePorts.map((sourcePort) => {
    const portId = legacyBoundaryPortId(node, sourcePort, sourcePorts.length);
    const label = typeof node.params?.label === "string" && node.params.label.trim()
      ? node.params.label
      : sourcePort.label;
    return omitUndefined({
      ...sourcePort,
      id: portId,
      direction: boundaryDirection,
      label,
      boundaryNodeId: node.id,
      boundaryPortId: sourcePort.id
    });
  });
}

function legacyBoundaryPortId(
  node: ContractGraphNodeV01 & { params?: Record<string, unknown> },
  port: PortSpecV01,
  eligiblePortCount: number
): string {
  return (
    legacyBoundaryParam(node, "portId") ??
    legacyBoundaryParam(node, "externalPortId") ??
    (eligiblePortCount === 1 ? node.id : port.id)
  );
}

function legacyBoundaryParam(
  node: ContractGraphNodeV01 & { params?: Record<string, unknown> },
  key: string
): string | undefined {
  const value = node.params?.[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function metadataString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function patchDefinitionToDisplayGraph(definition: PatchDefinitionV01): DisplayGraphDocumentV01 {
  return contractGraphToDisplayGraph(definition.graph);
}

export function displayGraphToContractGraph(graph: DisplayGraphDocumentV01): GraphDocumentV01 {
  return {
    schema: "skenion.graph",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    id: graph.id,
    revision: graph.revision,
    nodes: graph.nodes.map(displayNodeToContractNode),
    edges: graph.edges.map(displayEdgeToEdgeSpec)
  };
}

export function displayNodeToContractNode(node: DisplayGraphNodeV01): GraphDocumentV01["nodes"][number] {
  const implementation = node.implementation ? clone(node.implementation) : implementationForDisplayKind(node.kind, node.kindVersion);
  return omitUndefined({
    id: node.id,
    implementation,
    objectSpec: node.objectSpec ?? objectSpecForDisplayKind(node.kind),
    objectResolution: node.objectResolution ? clone(node.objectResolution) : undefined,
    bindingRef: node.bindingRef,
    params: { ...node.params },
    ports: node.ports.map(graphPortToPortSpec),
    ...("portGroups" in node && Array.isArray(node.portGroups)
      ? {
          portGroups: node.portGroups.map(displayPortGroupToPortGroupSpec)
        }
      : {})
  }) as GraphDocumentV01["nodes"][number];
}

export function contractGraphToDisplayGraph(graph: GraphDocumentV01): DisplayGraphDocumentV01 {
  return {
    schema: "skenion.graph",
    schemaVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    id: graph.id,
    revision: graph.revision,
    nodes: graph.nodes.map(contractNodeToDisplayNode),
    edges: graph.edges.map(edgeSpecToDisplayEdge)
  };
}

function contractNodeToDisplayNode(node: ContractGraphNodeV01): DisplayGraphNodeV01 {
  const legacyNode = node as ContractGraphNodeV01 & { kind?: unknown; kindVersion?: unknown };
  const implementation = "implementation" in node ? node.implementation : undefined;

  return omitUndefined({
    id: node.id,
    kind: displayKindForContractNode(legacyNode.kind, implementation),
    kindVersion: displayKindVersionForContractNode(legacyNode.kindVersion, implementation),
    implementation: implementation ? clone(implementation) : undefined,
    objectSpec: "objectSpec" in node ? node.objectSpec : undefined,
    objectResolution: "objectResolution" in node && node.objectResolution ? clone(node.objectResolution) : undefined,
    bindingRef: "bindingRef" in node ? node.bindingRef : undefined,
    params: { ...node.params },
    ports: node.ports.map(portSpecToGraphPort),
    ...(node.portGroups ? { portGroups: node.portGroups.map(portGroupSpecToDisplayPortGroup) } : {})
  }) as DisplayGraphNodeV01;
}

function displayKindForContractNode(
  legacyKind: unknown,
  implementation?: ObjectImplementationRefV01
): string {
  if (typeof legacyKind === "string" && legacyKind.trim()) {
    return displayKindForRuntimeKind(legacyKind);
  }
  if (!implementation) {
    return "object";
  }
  if (implementation.provider.kind === "core") {
    return displayKindForCoreObjectId(implementation.objectId);
  }
  if (implementation.provider.kind === "projectPatch") {
    return SUBPATCH_NODE_KIND;
  }
  return "object.external";
}

const CORE_OBJECT_DISPLAY_KIND_BY_OBJECT_ID: Record<string, string> = {
  "audio.input": "audio.input",
  "audio.operator.add": "audio.operator.add",
  "audio.operator.mul": "audio.operator.mul",
  "audio.osc": "audio.osc",
  "audio.output": "audio.output",
  "audio.sig": "audio.sig",
  bang: "core.bang",
  bool: "core.bool",
  color: "core.color",
  comment: "core.comment",
  float: "core.float",
  inlet: "core.inlet",
  int: "core.int",
  message: "core.message",
  "operator.add": "core.operator.add",
  "operator.div": "core.operator.div",
  "operator.max": "core.operator.max",
  "operator.min": "core.operator.min",
  "operator.mul": "core.operator.mul",
  "operator.pow": "core.operator.pow",
  "operator.sqrt": "core.operator.sqrt",
  "operator.sub": "core.operator.sub",
  outlet: "core.outlet",
  panel: "core.panel",
  preview: "core.preview",
  "render.clear-color": "render.clear-color",
  "render.fullscreen-shader": "render.fullscreen-shader",
  "render.output": "render.output",
  string: "core.string",
  "core.string": "core.string",
  "core.bool": "core.bool",
  subpatch: SUBPATCH_NODE_KIND,
  "video-asset": "core.video-asset",
  "video-decode": "core.video-decode",
  "gpu-upload": "core.gpu-upload"
};

const CORE_OBJECT_ID_BY_DISPLAY_KIND: Record<string, string> = Object.fromEntries(
  Object.entries(CORE_OBJECT_DISPLAY_KIND_BY_OBJECT_ID).map(([objectId, displayKind]) => [displayKind, objectId])
);

export function implementationForDisplayKind(
  displayKind: string,
  version: string = CURRENT_CONTRACT_SCHEMA_VERSION
): ObjectImplementationRefV01 | undefined {
  const objectId = CORE_OBJECT_ID_BY_DISPLAY_KIND[displayKind];
  return objectId
    ? {
        provider: { kind: "core" },
        objectId,
        version
      }
    : undefined;
}

function objectSpecForDisplayKind(displayKind: string): string | undefined {
  return CORE_OBJECT_ID_BY_DISPLAY_KIND[displayKind];
}

function displayKindForRuntimeKind(kind: string): string {
  if (!kind.startsWith("object.core.")) {
    return kind;
  }
  return displayKindForCoreObjectId(kind.slice("object.core.".length));
}

function displayKindForCoreObjectId(objectId: string): string {
  return CORE_OBJECT_DISPLAY_KIND_BY_OBJECT_ID[objectId] ?? "object.core";
}

function displayKindVersionForContractNode(
  legacyKindVersion: unknown,
  implementation?: ObjectImplementationRefV01
): string {
  if (typeof legacyKindVersion === "string" && legacyKindVersion.trim()) {
    return legacyKindVersion;
  }
  return implementation?.version ?? CURRENT_CONTRACT_SCHEMA_VERSION;
}

export function portSpecToGraphPort(port: PortSpecV01): PortV01 {
  const graphPort: PortV01 & PortSpecDisplayExtras = {
    id: port.id,
    direction: port.direction,
    label: port.label ?? labelForPatchPort(port.id),
    type: dataTypeFromPortSpec(port),
    required: port.required ?? ((port.minConnections ?? 0) > 0),
    rate: port.rate,
    accepts: port.accepts ? port.accepts.map(displayPortTypeFromPortSpecType) : undefined,
    minConnections: port.minConnections,
    maxConnections: port.maxConnections,
    mergePolicy: port.mergePolicy,
    fanOutPolicy: port.fanOutPolicy,
    triggerMode: port.triggerMode,
    defaultValue: port.defaultValue,
    latch: port.latch,
    styleKey: port.styleKey,
    group: port.group,
    description: port.description
  };

  const activation = activationForPortSpec(port);
  if (port.direction === "input" && activation) {
    graphPort.activation = activation;
  }
  if (Object.hasOwn(port, "defaultValue")) {
    graphPort.default = port.defaultValue;
  }

  return omitUndefined(graphPort);
}

export function graphPortToPortSpec(port: PortV01): PortSpecV01 {
  const extras = port as PortV01 & PortSpecDisplayExtras;
  const portSpec: PortSpecV01 = {
    id: port.id,
    direction: port.direction,
    type: portSpecTypeFromGraphPort(port),
    label: port.label,
    rate: extras.rate ?? portRateFromGraphPort(port),
    accepts: extras.accepts ? extras.accepts.map(canonicalPortTypeFromDisplayType) : undefined,
    minConnections: extras.minConnections,
    maxConnections: extras.maxConnections,
    mergePolicy: extras.mergePolicy,
    fanOutPolicy: extras.fanOutPolicy,
    triggerMode: extras.triggerMode ?? triggerModeFromGraphPort(port),
    messageKeys: extras.messageKeys ?? defaultMessageKeysForPortSpecType(portSpecTypeFromGraphPort(port), port.direction),
    defaultValue: Object.hasOwn(port, "default") ? port.default : extras.defaultValue,
    latch: extras.latch ?? (port.activation === "latched" ? true : undefined),
    required: port.required,
    styleKey: extras.styleKey,
    group: extras.group,
    description: extras.description
  };

  return omitUndefined(portSpec);
}

function defaultMessageKeysForPortSpecType(
  type: string,
  direction: PortSpecV01["direction"]
): PortSpecV01["messageKeys"] | undefined {
  if (direction !== "input" || type !== "value.core.message") {
    return undefined;
  }

  return {
    accepted: ["bang", "set", "message"],
    trigger: ["bang"],
    silent: ["set"],
    store: ["set"],
    emit: ["message"]
  };
}

export function dataTypeFromPortSpec(port: PortSpecV01): DataTypeV01 {
  const type = normalizedPortSpecType(port.type);
  const graphType: DataTypeV01 = {
    flow: flowForPortSpecType(type, port.rate),
    dataKind: dataKindForPortSpecType(type)
  };

  const format = formatForPortSpecType(type) ?? defaultFormatForDataKind(graphType.dataKind);
  if (format) {
    graphType.format = format;
  }

  return graphType;
}

function edgeSpecToDisplayEdge(edge: EdgeSpecV01): DisplayEdgeV01 {
  return omitUndefined({
    from: {
      node: edge.source.nodeId,
      port: edge.source.portId
    },
    to: {
      node: edge.target.nodeId,
      port: edge.target.portId
    },
    id: edge.id,
    resolvedType: edge.resolvedType,
    order: edge.order,
    enabled: edge.enabled,
    adapter: edge.adapter,
    feedback: edge.feedback ? { ...edge.feedback } : undefined,
    styleOverride: edge.styleOverride,
    label: edge.label,
    description: edge.description
  }) as DisplayEdgeV01;
}

export function displayEdgeToEdgeSpec(edge: DisplayEdgeV01): EdgeSpecV01 {
  const extras = edge as DisplayEdgeV01 & Partial<Omit<EdgeSpecV01, "id" | "source" | "target">> & { id?: string };
  return omitUndefined({
    id: extras.id ?? displayEdgeId(edge),
    source: {
      nodeId: edge.from.node,
      portId: edge.from.port
    },
    target: {
      nodeId: edge.to.node,
      portId: edge.to.port
    },
    resolvedType: extras.resolvedType ? canonicalPortTypeFromDisplayType(extras.resolvedType) : undefined,
    order: extras.order,
    enabled: extras.enabled,
    adapter: extras.adapter,
    feedback: extras.feedback,
    styleOverride: extras.styleOverride,
    label: extras.label,
    description: extras.description
  });
}

function displayPortGroupToPortGroupSpec(group: PortGroupSpecV01): PortGroupSpecV01 {
  return {
    ...group,
    type: canonicalPortTypeFromDisplayType(group.type)
  };
}

function portGroupSpecToDisplayPortGroup(group: PortGroupSpecV01): PortGroupSpecV01 {
  return {
    ...group,
    type: displayPortTypeFromPortSpecType(group.type)
  };
}

function activationForPortSpec(port: PortSpecV01): PortV01["activation"] | undefined {
  if (port.triggerMode === "trigger" || port.triggerMode === "latched") {
    return port.triggerMode;
  }
  if (port.latch) {
    return "latched";
  }
  return undefined;
}

function triggerModeFromGraphPort(port: PortV01): PortSpecV01["triggerMode"] | undefined {
  if (port.activation === "trigger" || port.activation === "latched") {
    return port.activation;
  }
  return undefined;
}

function normalizedPortSpecType(type: string): string {
  return type.trim();
}

function portSpecTypeFromGraphPort(port: PortV01): string {
  const dataKind = port.type.dataKind;
  if (dataKind.startsWith("value.core.")) {
    return dataKind;
  }
  if (port.type.flow === "event" && dataKind === "event.bang") {
    return "value.core.bang";
  }
  if (port.type.flow === "event" && dataKind === "message.any") {
    return "value.core.message";
  }
  if (isControlFlow(port.type.flow) && dataKind === "boolean") {
    return "value.core.bool";
  }
  if (isControlFlow(port.type.flow) && dataKind === "color") {
    return "value.core.color";
  }
  if (isControlFlow(port.type.flow) && dataKind === "message.any") {
    return "value.core.message";
  }
  if (isControlFlow(port.type.flow) && dataKind === "number.float") {
    return "value.core.float32";
  }
  if (isControlFlow(port.type.flow) && dataKind === "number.int") {
    return valueCoreIntegerKindForFormat(port.type.format);
  }
  if (isControlFlow(port.type.flow) && dataKind === "string") {
    return "value.core.string";
  }
  if (port.type.flow === "signal" && dataKind === "signal.audio") {
    return "media.audio-stream";
  }
  if (port.type.flow === "stream" && dataKind === "video.frame") {
    return "media.video-frame";
  }
  if (port.type.flow === "resource" && dataKind === "asset.video") {
    return "resource.asset.video";
  }
  if (port.type.flow === "resource" && dataKind === "gpu.texture2d") {
    return "resource.gpu.texture2d";
  }
  if (port.type.flow === "resource" && dataKind !== "gpu.texture2d" && dataKind !== "render.frame") {
    return `resource.${dataKind}`;
  }
  if (port.type.flow === "stream" && !dataKind.startsWith("stream.")) {
    return `stream.${dataKind}`;
  }
  if (isControlFlow(port.type.flow) && isGenericValueDataKind(dataKind)) {
    return `value.${dataKind}`;
  }
  return dataKind;
}

function valueCoreIntegerKindForFormat(format: DataTypeV01["format"]): string {
  const text = typeof format === "string" ? format : "i32";
  const unsigned = text.match(/^u(8|16|32|64)$/u);
  if (unsigned) {
    return `value.core.uint${unsigned[1]}`;
  }
  const signed = text.match(/^i(8|16|32|64)$/u);
  return `value.core.int${signed?.[1] ?? "32"}`;
}

function canonicalPortTypeFromDisplayType(type: string): string {
  switch (type) {
    case "boolean":
      return "value.core.bool";
    case "color":
      return "value.core.color";
    case "event.bang":
      return "value.core.bang";
    case "message.any":
      return "value.core.message";
    case "number.float":
      return "value.core.float32";
    case "number.int":
      return "value.core.int32";
    case "string":
      return "value.core.string";
    case "signal.audio":
      return "media.audio-stream";
    case "video.frame":
      return "media.video-frame";
    case "asset.video":
      return "resource.asset.video";
    case "gpu.texture2d":
      return "resource.gpu.texture2d";
    default:
      return type;
  }
}

function isGenericValueDataKind(dataKind: string): boolean {
  return ![
    "boolean",
    "color",
    "event.bang",
    "message.any",
    "number.float",
    "number.int",
    "string"
  ].includes(dataKind);
}

function portRateFromGraphPort(port: PortV01): PortSpecV01["rate"] | undefined {
  if (isControlFlow(port.type.flow)) {
    return "control";
  }
  switch (port.type.flow) {
    case "event":
      return "event";
    case "signal":
      return "audio";
    case "resource":
      return port.type.dataKind === "gpu.texture2d"
        ? "gpu"
        : port.type.dataKind === "render.frame"
          ? "render"
          : "resource";
    case "stream":
      return undefined;
  }
}

function flowForPortSpecType(type: string, rate: PortSpecV01["rate"]): DataFlow {
  if (type === "event.bang" || type === "message.any" || type === "value.core.bang" || type === "value.core.message" || rate === "event") {
    return "event";
  }
  if (type === "signal.audio" || type === "media.audio-stream" || rate === "audio") {
    return "signal";
  }
  if (type === "video.frame" || type === "media.video-frame" || type.startsWith("stream.")) {
    return "stream";
  }
  if (
    type === "asset.video" ||
    type === "gpu.texture2d" ||
    type === "render.frame" ||
    type.startsWith("resource.") ||
    rate === "gpu" ||
    rate === "render" ||
    rate === "resource"
  ) {
    return "resource";
  }
  return "control";
}

function isControlFlow(flow: DataFlow | string): boolean {
  return flow === "control" || flow === "value";
}

function dataKindForPortSpecType(type: string): string {
  if (type === "media.audio-stream") {
    return "signal.audio";
  }
  if (type === "media.video-frame") {
    return "video.frame";
  }
  if (type === "resource.asset.video") {
    return "asset.video";
  }
  if (type === "resource.gpu.texture2d") {
    return "gpu.texture2d";
  }
  if (type === "value.core.bang") {
    return "event.bang";
  }
  if (type === "value.core.bool") {
    return "boolean";
  }
  if (type === "value.core.color") {
    return "color";
  }
  if (type === "value.core.message") {
    return "message.any";
  }
  if (type.startsWith("value.core.float") || type.startsWith("value.core.ufloat")) {
    return "number.float";
  }
  if (type.startsWith("value.core.int")) {
    return "number.int";
  }
  if (type.startsWith("value.core.uint")) {
    return "number.int";
  }
  if (type === "value.core.string") {
    return "string";
  }
  if (type === "value.core.tensor") {
    return "value.core.tensor";
  }
  if (type === "render.frame") {
    return "render.frame";
  }
  if (type.startsWith("value.")) {
    return type.slice("value.".length);
  }
  if (type.startsWith("stream.")) {
    return type.slice("stream.".length);
  }
  if (type.startsWith("resource.")) {
    return type.slice("resource.".length);
  }
  return type;
}

function displayPortTypeFromPortSpecType(type: string): string {
  return dataKindForPortSpecType(normalizedPortSpecType(type));
}

function formatForPortSpecType(type: string): string | undefined {
  const integer = type.match(/^value\.core\.(u?int)(8|16|32|64)$/u);
  if (integer) {
    return `${integer[1] === "uint" ? "u" : "i"}${integer[2]}`;
  }
  const unsignedFloat = type.match(/^value\.core\.ufloat(8|16|32|64)$/u);
  if (unsignedFloat) {
    return `ufloat${unsignedFloat[1]}`;
  }
  const float = type.match(/^value\.core\.float(8|16|32|64)$/u);
  if (float) {
    return float[1] === "8" ? "f8.e4m3" : `f${float[1]}`;
  }
  return undefined;
}

function defaultFormatForDataKind(dataKind: string): string | undefined {
  if (dataKind === "number.float") {
    return "f32";
  }
  if (dataKind === "number.int") {
    return "i32";
  }
  if (dataKind === "color") {
    return "rgba32f";
  }
  return undefined;
}

function uniqueSubpatchNodeId(patchId: string, existingNodes: DisplayGraphNodeV01[]): string {
  const baseId = slugForNodeId(patchId) || "subpatch";
  let index = existingNodes.length + 1;
  let id = `${baseId}_${index}`;
  const existingIds = new Set(existingNodes.map((node) => node.id));

  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }

  return id;
}

function slugForNodeId(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_]+/gu, "_")
    .replace(/^_+|_+$/gu, "");
}

function labelForPatchPort(id: string): string {
  return id
    .split(/[-_]/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function displayEdgeId(edge: DisplayEdgeV01): string {
  return `edge_${edge.from.node}_${edge.from.port}_${edge.to.node}_${edge.to.port}`;
}

function omitUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  ) as T;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
