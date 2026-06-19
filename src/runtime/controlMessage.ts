import type { RuntimeControlMessage, RuntimeControlValue } from "./types";

export const bangControlMessage = (): RuntimeControlMessage => ({
  selector: "bang",
  atoms: []
});

export function controlMessageFromValue(value: RuntimeControlValue): RuntimeControlMessage {
  return {
    selector: selectorForControlValue(value),
    atoms: [value]
  };
}

export function setControlMessage(value: RuntimeControlValue): RuntimeControlMessage {
  return {
    selector: "set",
    atoms: [value]
  };
}

export function firstControlAtom(message: RuntimeControlMessage): RuntimeControlValue | null {
  return message.atoms[0] ?? null;
}

export function runtimeControlValueEquals(
  a: RuntimeControlValue | undefined,
  b: RuntimeControlValue | undefined
): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "color" && b.type === "color") {
    return (
      a.representation === b.representation &&
      a.colorSpace === b.colorSpace &&
      a.value.length === b.value.length &&
      a.value.every((value, index) => Object.is(value, b.value[index]))
    );
  }
  if (a.type === "float" && b.type === "float") {
    return a.representation === b.representation && Object.is(a.value, b.value);
  }
  if (a.type === "int" && b.type === "int") {
    return a.representation === b.representation && Object.is(a.value, b.value);
  }
  if (a.type === "uint" && b.type === "uint") {
    return a.representation === b.representation && Object.is(a.value, b.value);
  }
  if (a.type === "bool" && b.type === "bool") {
    return a.value === b.value;
  }
  return a.type === "string" && b.type === "string" && a.value === b.value;
}

function selectorForControlValue(value: RuntimeControlValue): string {
  if (value.type === "float") {
    return "float";
  }
  if (value.type === "int") {
    return "int";
  }
  if (value.type === "uint") {
    return "uint";
  }
  if (value.type === "bool") {
    return "bool";
  }
  if (value.type === "color") {
    return "color";
  }
  return "symbol";
}
