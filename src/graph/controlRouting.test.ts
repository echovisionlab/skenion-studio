import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  isReceiveNode,
  isSendNode,
  defaultReceiveParams,
  readChannelNameParam,
  readReceiveDefaultValue,
  receiveDataKind,
  runtimeValueForDataKind,
  sendDataKind
} from "./controlRouting";

describe("control routing graph helpers", () => {
  it("identifies typed send and receive nodes", () => {
    expect(isSendNode(node("core.send-f32", { name: "speed" }))).toBe(true);
    expect(isReceiveNode(node("core.receive-bool", { name: "enabled", default: true }))).toBe(true);
    expect(isSendNode(null)).toBe(false);
    expect(isReceiveNode(null)).toBe(false);
    expect(isSendNode(node("core.value-f32", {}))).toBe(false);
    expect(sendDataKind("core.send-f32")).toBe("number.f32");
    expect(sendDataKind("core.send-i32")).toBe("number.i32");
    expect(sendDataKind("core.send-bool")).toBe("boolean");
    expect(sendDataKind("core.send-rgba")).toBe("color.rgba");
    expect(sendDataKind("missing")).toBeNull();
    expect(receiveDataKind("core.receive-f32")).toBe("number.f32");
    expect(receiveDataKind("core.receive-i32")).toBe("number.i32");
    expect(receiveDataKind("core.receive-bool")).toBe("boolean");
    expect(receiveDataKind("core.receive-rgba")).toBe("color.rgba");
    expect(receiveDataKind("missing")).toBeNull();
  });

  it("normalizes channel params and receive defaults", () => {
    expect(readChannelNameParam(node("core.send-f32", { name: "speed" }))).toBe("speed");
    expect(readChannelNameParam(node("core.send-f32", { name: "" }))).toBe("channel");
    expect(readReceiveDefaultValue(node("core.receive-f32", { default: 1.25 }))).toEqual({
      type: "f32",
      value: 1.25
    });
    expect(readReceiveDefaultValue(node("core.receive-bool", { default: true }))).toEqual({
      type: "bool",
      value: true
    });
    expect(readReceiveDefaultValue(node("core.receive-i32", { default: 4 }))).toEqual({
      type: "i32",
      value: 4
    });
    expect(readReceiveDefaultValue(node("core.receive-rgba", { default: [-1, 0.25, 2, 1] }))).toEqual({
      type: "rgba",
      value: [0, 0.25, 1, 1]
    });
    expect(readReceiveDefaultValue(node("core.receive-rgba", { default: [1, "bad", 0, 1] }))).toEqual({
      type: "rgba",
      value: [1, 1, 1, 1]
    });
    expect(readReceiveDefaultValue(node("core.receive-rgba", { default: "bad" }))).toEqual({
      type: "rgba",
      value: [1, 1, 1, 1]
    });
    expect(readReceiveDefaultValue(node("missing", {}))).toEqual({
      type: "f32",
      value: 0
    });
    expect(readReceiveDefaultValue(node("core.receive-i32", { default: 1.5 }))).toEqual({
      type: "i32",
      value: 0
    });
    expect(runtimeValueForDataKind("unknown", 99)).toEqual({
      type: "f32",
      value: 0
    });
    expect(defaultReceiveParams("missing")).toEqual({
      name: "channel",
      default: 0
    });
  });
});

function node(kind: string, params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "node_1",
    kind,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}
