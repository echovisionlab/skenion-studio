import type {
  DataFlow,
  DataTypeV01,
  NodeDefinitionManifestV01,
  ObjectImplementationRefV01,
  ObjectResolutionV01,
  PortActivation,
  PortV01
} from "@skenion/contracts";
import {
  OBJECT_SPEC_SCHEMA_VERSION,
  parseObjectSpecV01,
  type ObjectSpecAtomV01,
  type ObjectSpecDiagnosticV01,
  type ObjectSpecParseResultV01,
  type ObjectSpecPortV01
} from "./objectSpecParser";
import {
  createSubpatchNodeFromDefinition,
  CURRENT_CONTRACT_SCHEMA_VERSION,
  findPatchDefinition,
  implementationForDisplayKind,
  portSpecToGraphPort,
  SUBPATCH_NODE_KIND,
  type DisplayGraphNodeV01,
  type PatchLibrary
} from "./patchLibrary";

export const OBJECT_DISPLAY_KIND = "object";

const OBJECT_SPEC_SCHEMA = "skenion.object-spec.parse-result" as const;

const NATIVE_OBJECT_ALIASES = new Map<string, string>([
  ["decode", "core.video-decode"],
  ["upload", "core.gpu-upload"],
  ["preview", "core.preview"]
]);

const OBJECT_SPEC_TYPE_BY_CORE_VALUE_DATA_KIND: Record<string, string> = {
  "value.core.bool": "boolean",
  "value.core.color": "color",
  "value.core.float8": "number.float",
  "value.core.float16": "number.float",
  "value.core.float32": "number.float",
  "value.core.float64": "number.float",
  "value.core.int8": "number.int",
  "value.core.int16": "number.int",
  "value.core.int32": "number.int",
  "value.core.int64": "number.int",
  "value.core.message": "message.any",
  "value.core.string": "string",
  "value.core.uint8": "number.uint",
  "value.core.uint16": "number.uint",
  "value.core.uint32": "number.uint",
  "value.core.uint64": "number.uint"
};

export interface ObjectNodeBuildResult {
  ok: boolean;
  node: DisplayGraphNodeV01 | null;
  parseResult: ObjectSpecParseResultV01;
  diagnostics: ObjectSpecDiagnosticV01[];
}

export interface ObjectNodeBuildOptions {
  nodeId?: string;
  patchLibrary?: PatchLibrary;
}

interface LocalObjectProjection {
  displayKind: string;
  displayKindVersion: string;
  params: Record<string, unknown>;
  instancePorts: ObjectSpecPortV01[];
}

export function createGraphNodeFromObjectSpec(
  input: string,
  existingNodes: DisplayGraphNodeV01[],
  registry: NodeDefinitionManifestV01[] = [],
  options: ObjectNodeBuildOptions = {}
): ObjectNodeBuildResult {
  const displayText = normalizeObjectSpecDisplay(input);
  const parseResult = parseObjectSpecV01(input);
  if (displayText.length === 0) {
    return {
      ok: false,
      node: null,
      parseResult,
      diagnostics: parseResult.diagnostics
    };
  }

  const subpatchObject = subpatchObjectSpec(displayText);
  if (subpatchObject) {
    return createSubpatchObjectNode(input, displayText, subpatchObject, parseResult, existingNodes, options);
  }

  const nativeAliasKind = nativeObjectKindForText(displayText);
  if (nativeAliasKind) {
    return createNativeAliasObjectNode(input, displayText, nativeAliasKind, parseResult, registry, existingNodes, options.nodeId);
  }

  const projection = localObjectProjection(parseResult);
  if (!parseResult.ok || !projection) {
    const diagnostics = diagnosticsForUnresolvedParse(parseResult);
    return unresolvedObjectResult(
      input,
      parseResult.displayText,
      requestedObjectForParseResult(parseResult, projection),
      parseResult,
      diagnostics,
      existingNodes,
      options.nodeId
    );
  }

  const registryDiagnostic = objectSpecRegistryDiagnostic(parseResult, registry);
  if (registryDiagnostic) {
    const diagnostics = [...parseResult.diagnostics, registryDiagnostic];
    return unresolvedObjectResult(
      input,
      parseResult.displayText,
      projection.displayKind,
      parseResult,
      diagnostics,
      existingNodes,
      options.nodeId
    );
  }

  const implementation = implementationForDisplayKind(projection.displayKind, projection.displayKindVersion);
  const objectResolution = implementation ? resolvedObjectResolution(parseResult.displayText, implementation) : undefined;
  const node: DisplayGraphNodeV01 = {
    id: options.nodeId ?? uniqueObjectNodeId(projection.displayKind, existingNodes),
    kind: projection.displayKind,
    kindVersion: projection.displayKindVersion,
    objectSpec: parseResult.displayText,
    ...(implementation ? { implementation } : {}),
    ...(objectResolution ? { objectResolution } : {}),
    params: {
      ...projection.params,
      label: parseResult.displayText
    },
    ports: projection.instancePorts.map(objectSpecPortToGraphPort)
  };

  return {
    ok: true,
    node,
    parseResult: enrichParseResult(parseResult, projection, implementation, objectResolution),
    diagnostics: parseResult.diagnostics
  };
}

export function isUnresolvedObjectNode(node: DisplayGraphNodeV01): boolean {
  const status = node.objectResolution?.status;
  return status !== undefined && status !== "resolved";
}

export function nativeAliasForObjectKind(kind: string): string | null {
  for (const [alias, nativeKind] of NATIVE_OBJECT_ALIASES) {
    if (nativeKind === kind) {
      return alias;
    }
  }
  return null;
}

export function objectSpecRegistryDiagnostic(
  parseResult: ObjectSpecParseResultV01,
  registry: NodeDefinitionManifestV01[]
): ObjectSpecDiagnosticV01 | null {
  const projection = localObjectProjection(parseResult);
  if (!parseResult.ok || !projection || registry.length === 0) {
    return null;
  }

  const definition = registry.find(
    (candidate) => candidate.id === projection.displayKind && candidate.version === projection.displayKindVersion
  );
  if (!definition) {
    return unavailableObjectDiagnostic(projection.displayKind);
  }

  return null;
}

export function objectSpecPortToGraphPort(port: ObjectSpecPortV01): PortV01 {
  const graphPort: PortV01 & { description?: string } = {
    id: port.id,
    direction: port.direction,
    label: labelForObjectSpecPort(port.id),
    type: objectSpecTypeToGraphType(port.type),
    required: false
  };

  if (port.description) {
    graphPort.description = port.description;
  }
  const activation = graphActivation(port.activation);
  if (port.direction === "input" && activation) {
    graphPort.activation = activation;
  }
  if (Object.hasOwn(port, "defaultValue")) {
    graphPort.default = port.defaultValue;
  }

  return graphPort;
}

export function objectSpecTypeToGraphType(type: string): DataTypeV01 {
  const flow = flowForObjectSpecType(type);
  const graphType: DataTypeV01 = {
    flow,
    dataKind: type
  };

  const format = defaultFormatForObjectSpecType(type);
  if (format) {
    graphType.format = format;
  }

  return graphType;
}

function createSubpatchObjectNode(
  input: string,
  displayText: string,
  subpatchObject: SubpatchObjectSpec,
  parseResult: ObjectSpecParseResultV01,
  existingNodes: DisplayGraphNodeV01[],
  options: ObjectNodeBuildOptions
): ObjectNodeBuildResult {
  const diagnostics = diagnosticsForSubpatchObjectSpec(subpatchObject, options.patchLibrary);
  if (diagnostics.length > 0 || !subpatchObject.patchId) {
    const subpatchParseResult = parseResultForSubpatch(input, displayText, subpatchObject.patchId ?? "", false, [], diagnostics);
    return unresolvedObjectResult(
      input,
      displayText,
      SUBPATCH_NODE_KIND,
      subpatchParseResult,
      diagnostics,
      existingNodes,
      options.nodeId
    );
  }

  const patchDefinition = findPatchDefinition(options.patchLibrary, subpatchObject.patchId)!;
  const subpatchNode = createSubpatchNodeFromDefinition(patchDefinition, existingNodes, {
    nodeId: options.nodeId,
    objectSpec: displayText
  });
  const subpatchParseResult = parseResultForSubpatch(
    input,
    displayText,
    subpatchObject.patchId,
    true,
    subpatchNode.ports.map(graphPortToObjectSpecPort),
    []
  );

  return {
    ok: true,
    node: subpatchNode,
    parseResult: {
      ...parseResult,
      ...subpatchParseResult
    },
    diagnostics: []
  };
}

function createNativeAliasObjectNode(
  input: string,
  displayText: string,
  nativeAliasKind: string,
  parseResult: ObjectSpecParseResultV01,
  registry: NodeDefinitionManifestV01[],
  existingNodes: DisplayGraphNodeV01[],
  nodeId?: string
): ObjectNodeBuildResult {
  const definition = registry.find((candidate) => candidate.id === nativeAliasKind);
  if (!definition) {
    const diagnostic = unavailableObjectDiagnostic(nativeAliasKind);
    return unresolvedObjectResult(input, displayText, nativeAliasKind, parseResult, [diagnostic], existingNodes, nodeId);
  }

  const aliasParseResult = parseResultForNativeAlias(input, displayText, definition);
  return {
    ok: true,
    node: graphNodeFromDefinition(definition, existingNodes, { label: displayText }, displayText, nodeId),
    parseResult: aliasParseResult,
    diagnostics: []
  };
}

function graphNodeFromDefinition(
  definition: NodeDefinitionManifestV01,
  existingNodes: DisplayGraphNodeV01[],
  paramsOverride: Record<string, unknown>,
  objectSpec: string,
  nodeId?: string
): DisplayGraphNodeV01 {
  const implementation = implementationForDisplayKind(definition.id, definition.version);
  const objectResolution = implementation ? resolvedObjectResolution(objectSpec, implementation) : undefined;
  return {
    id: nodeId ?? uniqueObjectNodeId(definition.id, existingNodes),
    kind: definition.id,
    kindVersion: definition.version,
    objectSpec,
    ...(implementation ? { implementation } : {}),
    ...(objectResolution ? { objectResolution } : {}),
    params: paramsOverride,
    ports: definition.ports.map(portSpecToGraphPort),
    ...(definition.portGroups ? { portGroups: definition.portGroups.map((group) => ({ ...group })) } : {})
  };
}

function uniqueObjectNodeId(kind: string, existingNodes: DisplayGraphNodeV01[]): string {
  const baseId = kind.slice(kind.lastIndexOf(".") + 1);
  let index = existingNodes.length + 1;
  let id = `${baseId}_${index}`;
  const existingIds = new Set(existingNodes.map((node) => node.id));

  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}_${index}`;
  }

  return id;
}

function normalizeObjectSpecDisplay(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function nativeObjectKindForText(displayText: string): string | null {
  const [className, ...rest] = displayText.split(/\s+/u).filter(Boolean);
  if (!className || rest.length > 0) {
    return null;
  }
  return NATIVE_OBJECT_ALIASES.get(className) ?? null;
}

interface SubpatchObjectSpec {
  patchId: string | null;
  diagnostics: ObjectSpecDiagnosticV01[];
}

function subpatchObjectSpec(displayText: string): SubpatchObjectSpec | null {
  const tokens = displayText.split(/\s+/u).filter(Boolean);
  if (tokens[0] !== "p") {
    return null;
  }
  if (tokens.length === 2) {
    return {
      patchId: tokens[1]!,
      diagnostics: []
    };
  }
  if (tokens.length === 1) {
    return {
      patchId: null,
      diagnostics: [
        {
          severity: "error",
          code: "missing-subpatch-id",
          message: "Subpatch object spec must include a patch id, such as p oscillator."
        }
      ]
    };
  }
  return {
    patchId: tokens[1],
    diagnostics: [
      {
        severity: "error",
        code: "invalid-subpatch-object-spec",
        message: "Subpatch object spec accepts exactly one patch id."
      }
    ]
  };
}

function diagnosticsForSubpatchObjectSpec(
  subpatchObject: SubpatchObjectSpec,
  patchLibrary: PatchLibrary | undefined
): ObjectSpecDiagnosticV01[] {
  if (subpatchObject.diagnostics.length > 0) {
    return subpatchObject.diagnostics;
  }
  const patchId = subpatchObject.patchId as string;
  if (!patchLibrary) {
    return [
      {
        severity: "error",
        code: "patch-library-unavailable",
        message: `Patch library is not available, so p ${patchId} cannot be resolved.`
      }
    ];
  }
  if (!findPatchDefinition(patchLibrary, patchId)) {
    return [
      {
        severity: "error",
        code: "patch-definition-unavailable",
        message: `Patch ${patchId} is not available in the patch library.`
      }
    ];
  }
  return [];
}

function unresolvedObjectResult(
  input: string,
  displayText: string,
  requestedObject: string,
  parseResult: ObjectSpecParseResultV01,
  diagnostics: ObjectSpecDiagnosticV01[],
  existingNodes: DisplayGraphNodeV01[],
  nodeId?: string
): ObjectNodeBuildResult {
  const diagnosticMessage = diagnostics[0]?.message ?? "Object could not be resolved.";
  const objectResolution: ObjectResolutionV01 = {
    status: "unresolved",
    selectedSpec: displayText,
    diagnostics: diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity,
      code: "resolution-unresolved",
      message: diagnostic.message
    }))
  };

  return {
    ok: false,
    node: {
      id: nodeId ?? uniqueObjectNodeId(OBJECT_DISPLAY_KIND, existingNodes),
      kind: OBJECT_DISPLAY_KIND,
      kindVersion: OBJECT_SPEC_SCHEMA_VERSION,
      objectSpec: displayText,
      objectResolution,
      params: {
        diagnosticMessage,
        requestedObject
      },
      ports: []
    },
    parseResult: {
      ...parseResult,
      input,
      ok: false,
      objectResolution,
      params: {},
      instancePorts: [],
      displayText,
      diagnostics
    },
    diagnostics
  };
}

function diagnosticsForUnresolvedParse(parseResult: ObjectSpecParseResultV01): ObjectSpecDiagnosticV01[] {
  const className = parseResult.className;
  const firstDiagnostic = parseResult.diagnostics[0];
  if (parseResult.ok && className) {
    return [
      {
        severity: "error",
        code: "object-unresolved",
        message: `Object "${className}" is not available in the current catalog.`
      }
    ];
  }
  if (firstDiagnostic?.code === "unsupported-class") {
    if (!className.includes(".")) {
      return [
        {
          severity: "error",
          code: "object-unresolved",
          message: `Object "${className}" is not available in the current catalog.`
        }
      ];
    }
    return [
      {
        severity: "error",
        code: "object-unavailable",
        message: `${className} is not available in the local runtime registry.`
      }
    ];
  }
  return parseResult.diagnostics;
}

function requestedObjectForParseResult(parseResult: ObjectSpecParseResultV01, projection: LocalObjectProjection | null): string {
  return projection?.displayKind ?? parseResult.className;
}

function unavailableObjectDiagnostic(kind: string): ObjectSpecDiagnosticV01 {
  return {
    severity: "error",
    code: "object-unavailable",
    message: `${kind} is not available in the local runtime registry.`
  };
}

function parseResultForNativeAlias(
  input: string,
  displayText: string,
  definition: NodeDefinitionManifestV01
): ObjectSpecParseResultV01 {
  const implementation = implementationForDisplayKind(definition.id, definition.version);
  const objectResolution = implementation ? resolvedObjectResolution(displayText, implementation) : undefined;
  return {
    schema: OBJECT_SPEC_SCHEMA,
    schemaVersion: OBJECT_SPEC_SCHEMA_VERSION,
    input,
    ok: true,
    className: displayText,
    creationArgs: [],
    ...(implementation ? { implementation } : {}),
    ...(objectResolution ? { objectResolution } : {}),
    params: {},
    instancePorts: definition.ports.map((port) => {
      const graphPort = portSpecToGraphPort(port);
      const objectPort: ObjectSpecPortV01 = {
        id: port.id,
        direction: port.direction,
        type: graphPort.type.dataKind
      };
      if (graphPort.activation) {
        objectPort.activation = graphPort.activation;
      }
      if (Object.hasOwn(graphPort, "default")) {
        objectPort.defaultValue = graphPort.default;
      }
      return objectPort;
    }),
    displayText,
    diagnostics: []
  };
}

function parseResultForSubpatch(
  input: string,
  displayText: string,
  patchId: string,
  ok: boolean,
  instancePorts: ObjectSpecPortV01[],
  diagnostics: ObjectSpecDiagnosticV01[]
): ObjectSpecParseResultV01 {
  const implementation: ObjectImplementationRefV01 | undefined = ok
    ? {
        provider: { kind: "projectPatch", patchId },
        objectId: patchId,
        version: CURRENT_CONTRACT_SCHEMA_VERSION
      }
    : undefined;
  const objectResolution = implementation ? resolvedObjectResolution(displayText, implementation, "project-patch") : undefined;
  return {
    schema: OBJECT_SPEC_SCHEMA,
    schemaVersion: OBJECT_SPEC_SCHEMA_VERSION,
    input,
    ok,
    className: "p",
    creationArgs: patchId ? [{ type: "identifier", value: patchId } satisfies ObjectSpecAtomV01] : [],
    ...(implementation ? { implementation } : {}),
    ...(objectResolution ? { objectResolution } : {}),
    params: patchId ? { patchId } : {},
    instancePorts,
    displayText,
    diagnostics
  };
}

function enrichParseResult(
  parseResult: ObjectSpecParseResultV01,
  projection: LocalObjectProjection,
  implementation: ObjectImplementationRefV01 | undefined,
  objectResolution: ObjectResolutionV01 | undefined
): ObjectSpecParseResultV01 {
  return {
    ...parseResult,
    ...(implementation ? { implementation } : {}),
    ...(objectResolution ? { objectResolution } : {}),
    params: projection.params,
    instancePorts: projection.instancePorts
  };
}

function resolvedObjectResolution(
  objectSpec: string,
  implementation: ObjectImplementationRefV01,
  reason = "studio-local"
): ObjectResolutionV01 {
  return {
    status: "resolved",
    selectedSpec: objectSpec,
    candidates: [
      {
        implementation,
        objectSpec,
        reason
      }
    ]
  };
}

function localObjectProjection(parseResult: ObjectSpecParseResultV01): LocalObjectProjection | null {
  if (!parseResult.ok) {
    return null;
  }
  switch (parseResult.className) {
    case "+":
      return resolvedObjectData("core.operator.add", controlAddParseData(firstNumericArg(parseResult.creationArgs)));
    case "*~":
      return resolvedObjectData("audio.operator.mul", audioMulParseData(firstNumericArg(parseResult.creationArgs)));
    case "osc~":
      return resolvedObjectData("audio.osc", audioOscParseData(firstNumericArg(parseResult.creationArgs)));
    default:
      return null;
  }
}

function resolvedObjectData(
  displayKind: string,
  data: Omit<LocalObjectProjection, "displayKind" | "displayKindVersion">
): LocalObjectProjection {
  return {
    displayKind,
    displayKindVersion: CURRENT_CONTRACT_SCHEMA_VERSION,
    ...data
  };
}

function firstNumericArg(args: ObjectSpecAtomV01[]): number | null {
  const first = args[0];
  return first && (first.type === "int" || first.type === "uint" || first.type === "float") ? first.value : null;
}

function controlAddParseData(right: number | null): Omit<LocalObjectProjection, "displayKind" | "displayKindVersion"> {
  return {
    params: right === null ? {} : { right },
    instancePorts: [
      { id: "in", direction: "input", type: "message.any", activation: "trigger" },
      withDefault({ id: "right", direction: "input", type: "number.float", activation: "latched" }, right),
      { id: "out", direction: "output", type: "number.float" }
    ]
  };
}

function audioMulParseData(right: number | null): Omit<LocalObjectProjection, "displayKind" | "displayKindVersion"> {
  return {
    params: right === null ? {} : { right },
    instancePorts: [
      { id: "in", direction: "input", type: "signal.audio" },
      withDefault({ id: "right", direction: "input", type: "number.float" }, right),
      { id: "out", direction: "output", type: "signal.audio" }
    ]
  };
}

function audioOscParseData(frequency: number | null): Omit<LocalObjectProjection, "displayKind" | "displayKindVersion"> {
  return {
    params: frequency === null ? {} : { frequency },
    instancePorts: [
      withDefault({ id: "frequency", direction: "input", type: "number.float", activation: "latched" }, frequency),
      { id: "out", direction: "output", type: "signal.audio" }
    ]
  };
}

function withDefault(port: ObjectSpecPortV01, value: number | null): ObjectSpecPortV01 {
  return value === null ? port : { ...port, defaultValue: value };
}

function graphPortToObjectSpecPort(port: PortV01): ObjectSpecPortV01 {
  const graphPort = port as PortV01 & {
    default?: unknown;
    description?: string;
    rate?: ObjectSpecPortV01["rate"];
  };
  const objectPort: ObjectSpecPortV01 = {
    id: port.id,
    direction: port.direction,
    type: objectSpecTypeForGraphType(graphPort.type)
  };
  if (graphPort.rate) {
    objectPort.rate = graphPort.rate;
  }
  if (graphPort.activation) {
    objectPort.activation = graphPort.activation;
  }
  if (Object.hasOwn(graphPort, "default")) {
    objectPort.defaultValue = graphPort.default;
  }
  if (graphPort.description) {
    objectPort.description = graphPort.description;
  }
  return objectPort;
}

function objectSpecTypeForGraphType(type: DataTypeV01): string {
  return type.flow === "control"
    ? OBJECT_SPEC_TYPE_BY_CORE_VALUE_DATA_KIND[type.dataKind] ?? type.dataKind
    : type.dataKind;
}

function graphActivation(activation: ObjectSpecPortV01["activation"]): PortActivation | undefined {
  return activation === "trigger" || activation === "latched" ? activation : undefined;
}

function flowForObjectSpecType(type: string): DataFlow {
  if (type === "event.bang" || type === "message.any") {
    return "event";
  }
  if (type === "signal.audio") {
    return "signal";
  }
  if (type === "video.frame") {
    return "stream";
  }
  if (type === "asset.video" || type === "gpu.texture2d") {
    return "resource";
  }
  return "control";
}

function defaultFormatForObjectSpecType(type: string): string | undefined {
  if (type === "number.float") {
    return "f32";
  }
  if (type === "number.int") {
    return "i32";
  }
  if (type === "number.uint") {
    return "u32";
  }
  if (type === "color") {
    return "rgba32f";
  }
  return undefined;
}

function labelForObjectSpecPort(id: string): string {
  return id
    .split(/[-_]/u)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}
