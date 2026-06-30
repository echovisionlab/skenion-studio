import type { PortDirection, PortRateV01 } from "@skenion/contracts";

export const OBJECT_TEXT_SCHEMA = "skenion.object-text.parse-result" as const;
export const OBJECT_TEXT_SCHEMA_VERSION = "0.1.0" as const;

export type ObjectTextAtomV01 =
  | { type: "int"; value: number; representation?: string }
  | { type: "float"; value: number; representation?: string }
  | { type: "bool"; value: boolean }
  | { type: "symbol"; value: string }
  | { type: "string"; value: string };

export interface ObjectTextDiagnosticV01 {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface ObjectTextPortV01 {
  id: string;
  direction: PortDirection;
  type: string;
  rate?: PortRateV01;
  accepts?: string[];
  activation?: "trigger" | "latched" | "passive";
  defaultValue?: unknown;
  description?: string;
}

export interface ObjectTextParseResultV01 {
  schema: typeof OBJECT_TEXT_SCHEMA;
  schemaVersion: typeof OBJECT_TEXT_SCHEMA_VERSION;
  input: string;
  ok: boolean;
  classSymbol: string;
  creationArgs: ObjectTextAtomV01[];
  resolvedKind: string | null;
  resolvedKindVersion: string | null;
  params: Record<string, unknown>;
  instancePorts: ObjectTextPortV01[];
  displayText: string;
  diagnostics: ObjectTextDiagnosticV01[];
}

const CONTRACT_VERSION = "0.1.0" as const;

// Draft-only offline parser for Studio object-box editing. It intentionally
// recognizes just the small local subset Studio can materialize without asking
// the Runtime or extension registry to resolve object text.
export function parseObjectTextV01(input: string): ObjectTextParseResultV01 {
  const normalized = normalizeObjectTextInput(input);
  if (!normalized.ok) {
    return failure(input, normalized.displayText, "<invalid>", [], "invalid-syntax", normalized.message);
  }

  const displayText = normalized.displayText;
  const tokens = displayText.split(/\s+/u).filter(Boolean);
  if (tokens.length === 0) {
    return failure(input, "<empty>", "<empty>", [], "empty-object-text", "Object text must include a class name.");
  }

  const [classSymbol, ...argTokens] = tokens;
  const creationArgs = argTokens.map(parseAtom);

  switch (classSymbol) {
    case "+":
      return resolvedObject(input, displayText, classSymbol, creationArgs, controlAddParseData(firstNumericArg(creationArgs)));
    case "*~":
      return resolvedObject(input, displayText, classSymbol, creationArgs, audioMulParseData(firstNumericArg(creationArgs)));
    case "osc~":
      return resolvedObject(input, displayText, classSymbol, creationArgs, audioOscParseData(firstNumericArg(creationArgs)));
    default:
      return unsupportedObject(input, displayText, classSymbol, creationArgs);
  }
}

interface NormalizeResult {
  ok: boolean;
  displayText: string;
  message: string;
}

interface ResolvedObjectParseData {
  resolvedKind: string;
  params: Record<string, unknown>;
  instancePorts: ObjectTextPortV01[];
}

function normalizeObjectTextInput(input: string): NormalizeResult {
  const trimmed = input.trim();
  if (trimmed.startsWith("[") || trimmed.endsWith("]")) {
    if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
      return {
        ok: false,
        displayText: trimmed,
        message: "Object text brackets must be balanced."
      };
    }
    return { ok: true, displayText: trimmed.slice(1, -1).trim(), message: "" };
  }
  return { ok: true, displayText: trimmed, message: "" };
}

function parseAtom(token: string): ObjectTextAtomV01 {
  if (/^[+-]?\d+$/u.test(token)) {
    return { type: "int", value: Number.parseInt(token, 10), representation: "i32" };
  }
  if (/^[+-]?(?:(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+))$/u.test(token)) {
    const value = Number.parseFloat(token);
    if (Number.isFinite(value)) {
      return { type: "float", value, representation: "f32" };
    }
  }
  if (token === "true" || token === "false") {
    return { type: "bool", value: token === "true" };
  }
  return { type: "symbol", value: token };
}

function firstNumericArg(args: ObjectTextAtomV01[]): number | null {
  const first = args[0];
  return first && (first.type === "int" || first.type === "float") ? first.value : null;
}

function resolvedObject(
  input: string,
  displayText: string,
  classSymbol: string,
  creationArgs: ObjectTextAtomV01[],
  parseData: ResolvedObjectParseData
): ObjectTextParseResultV01 {
  return {
    schema: OBJECT_TEXT_SCHEMA,
    schemaVersion: OBJECT_TEXT_SCHEMA_VERSION,
    input,
    ok: true,
    classSymbol,
    creationArgs,
    resolvedKind: parseData.resolvedKind,
    resolvedKindVersion: CONTRACT_VERSION,
    params: parseData.params,
    instancePorts: parseData.instancePorts,
    displayText,
    diagnostics: []
  };
}

function failure(
  input: string,
  displayText: string,
  classSymbol: string,
  creationArgs: ObjectTextAtomV01[],
  code: string,
  message: string
): ObjectTextParseResultV01 {
  return {
    schema: OBJECT_TEXT_SCHEMA,
    schemaVersion: OBJECT_TEXT_SCHEMA_VERSION,
    input,
    ok: false,
    classSymbol,
    creationArgs,
    resolvedKind: null,
    resolvedKindVersion: null,
    params: {},
    instancePorts: [],
    displayText,
    diagnostics: [{ severity: "error", code, message }]
  };
}

function unsupportedObject(
  input: string,
  displayText: string,
  classSymbol: string,
  creationArgs: ObjectTextAtomV01[]
): ObjectTextParseResultV01 {
  if (classSymbol.endsWith("~")) {
    return failure(
      input,
      displayText,
      classSymbol,
      creationArgs,
      "deferred-object",
      `${classSymbol} is not available in Studio's offline object parser yet.`
    );
  }
  return failure(
    input,
    displayText,
    classSymbol,
    creationArgs,
    "unsupported-class",
    `${classSymbol} is not available in Studio's offline object parser.`
  );
}

function controlAddParseData(right: number | null): ResolvedObjectParseData {
  return {
    resolvedKind: "core.operator.add",
    params: right === null ? {} : { right },
    instancePorts: [
      { id: "in", direction: "input", type: "message.any", activation: "trigger" },
      withDefault({ id: "right", direction: "input", type: "number.float", activation: "latched" }, right),
      { id: "out", direction: "output", type: "number.float" }
    ]
  };
}

function audioMulParseData(right: number | null): ResolvedObjectParseData {
  return {
    resolvedKind: "audio.operator.mul",
    params: right === null ? {} : { right },
    instancePorts: [
      { id: "in", direction: "input", type: "signal.audio" },
      withDefault({ id: "right", direction: "input", type: "number.float" }, right),
      { id: "out", direction: "output", type: "signal.audio" }
    ]
  };
}

function audioOscParseData(frequency: number | null): ResolvedObjectParseData {
  return {
    resolvedKind: "audio.osc",
    params: frequency === null ? {} : { frequency },
    instancePorts: [
      withDefault({ id: "frequency", direction: "input", type: "number.float", activation: "latched" }, frequency),
      { id: "out", direction: "output", type: "signal.audio" }
    ]
  };
}

function withDefault(port: ObjectTextPortV01, value: number | null): ObjectTextPortV01 {
  return value === null ? port : { ...port, defaultValue: value };
}
