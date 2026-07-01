import { describe, expect, it } from "vitest";
import type { NodeDefinitionManifestV01 } from "@skenion/contracts";
import { nodeRegistry } from "../data/registry";
import {
  createPatchLibrary,
  type DisplayGraphNodeV01 as GraphNodeV01,
  type PatchDefinitionV01
} from "./patchLibrary";
import {
  createGraphNodeFromObjectSpec,
  OBJECT_DISPLAY_KIND,
  objectSpecRegistryDiagnostic,
  objectSpecPortToGraphPort,
  objectSpecTypeToGraphType
} from "./objectNode";
import { genericObjectSpecForNode } from "./objectSpecDisplay";
import { parseObjectSpecV01 } from "./objectSpecParser";

describe("object node authoring adapter", () => {
  it("creates a canonical control operator node from object spec", () => {
    const result = createGraphNodeFromObjectSpec("+ 1.", []);

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "add_1",
      kind: "core.operator.add",
      kindVersion: "0.1.0",
      objectSpec: "+ 1.",
      params: {
        right: 1,
        label: "+ 1."
      }
    });
    expect(result.node?.ports).toEqual([
      {
        id: "in",
        direction: "input",
        label: "In",
        type: { flow: "event", dataKind: "message.any" },
        required: false,
        activation: "trigger"
      },
      {
        id: "right",
        direction: "input",
        label: "Right",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        required: false,
        activation: "latched",
        default: 1
      },
      {
        id: "out",
        direction: "output",
        label: "Out",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        required: false
      }
    ]);
  });

  it("parses Studio-local object spec syntax and atoms without runtime resolution", () => {
    expect(parseObjectSpecV01("[osc~ 440]").displayText).toBe("osc~ 440");
    expect(parseObjectSpecV01("[osc~ 440").diagnostics[0]).toMatchObject({
      code: "invalid-syntax"
    });
    expect(parseObjectSpecV01("print true").creationArgs).toEqual([{ type: "bool", value: true }]);
    expect(parseObjectSpecV01("print 1e999").creationArgs).toEqual([{ type: "identifier", value: "1e999" }]);
    expect(parseObjectSpecV01("+").params).toEqual({});
    expect(parseObjectSpecV01("*~").params).toEqual({});
    expect(parseObjectSpecV01("osc~").params).toEqual({});
  });

  it("creates audio signal nodes without losing scalar defaults", () => {
    const result = createGraphNodeFromObjectSpec("*~ 0.5", []);

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "mul_1",
      kind: "audio.operator.mul",
      objectSpec: "*~ 0.5",
      params: {
        right: 0.5,
        label: "*~ 0.5"
      }
    });
    expect(result.node?.ports.map((port) => [port.id, port.type, port.default ?? null])).toEqual([
      ["in", { flow: "signal", dataKind: "signal.audio" }, null],
      ["right", { flow: "control", dataKind: "number.float", format: "f32" }, 0.5],
      ["out", { flow: "signal", dataKind: "signal.audio" }, null]
    ]);
  });

  it("preserves object spec port descriptions in graph ports", () => {
    expect(
      objectSpecPortToGraphPort({
        id: "pitch",
        direction: "input",
        type: "number.float",
        description: "Pitch in MIDI note numbers."
      })
    ).toMatchObject({
      id: "pitch",
      description: "Pitch in MIDI note numbers."
    });
  });

  it("allows object spec instance ports to specialize a registry object class", () => {
    const result = createGraphNodeFromObjectSpec("*~ 0.5", [], nodeRegistry);

    expect(result.ok).toBe(true);
    expect(result.node?.kind).toBe("audio.operator.mul");
    expect(result.node?.ports.map((port) => port.id)).toEqual(["in", "right", "out"]);
  });

  it("allows registry-compatible object spec interfaces", () => {
    const add = createGraphNodeFromObjectSpec("+ 1", [], nodeRegistry);
    const oscillator = createGraphNodeFromObjectSpec("osc~ 440", [], nodeRegistry);

    expect(add.ok).toBe(true);
    expect(add.node?.kind).toBe("core.operator.add");
    expect(oscillator.ok).toBe(true);
    expect(oscillator.node?.kind).toBe("audio.osc");
  });

  it("preserves invalid or deferred object spec as unresolved nodes", () => {
    const invalid = createGraphNodeFromObjectSpec("sin~", []);
    const empty = createGraphNodeFromObjectSpec("", []);

    expect(invalid.ok).toBe(false);
    expect(invalid.node).toMatchObject({
      kind: OBJECT_DISPLAY_KIND,
      objectSpec: "sin~",
      objectResolution: {
        status: "unresolved",
        selectedSpec: "sin~",
        diagnostics: [{ code: "resolution-unresolved" }]
      },
      params: {
        requestedObject: "sin~"
      },
      ports: []
    });
    expect(invalid.diagnostics[0]?.code).toBe("object-unresolved");
    expect(empty.ok).toBe(false);
    expect(empty.node).toBeNull();
  });

  it("resolves lowercase native aliases through the local registry", () => {
    const decode = createGraphNodeFromObjectSpec("decode", [], nodeRegistry);
    const upload = createGraphNodeFromObjectSpec("upload", [], nodeRegistry);
    const preview = createGraphNodeFromObjectSpec("preview", [], nodeRegistry);

    expect(decode).toMatchObject({ ok: true, node: { kind: "core.video-decode" } });
    expect(upload).toMatchObject({ ok: true, node: { kind: "core.gpu-upload" } });
    expect(preview).toMatchObject({ ok: true, node: { kind: "core.preview" } });
    expect(genericObjectSpecForNode(decode.node!)).toBe("decode");
    expect(genericObjectSpecForNode(upload.node!)).toBe("upload");
    expect(genericObjectSpecForNode(preview.node!)).toBe("preview");
  });

  it("normalizes bracketed native aliases and reports missing native definitions", () => {
    const missingDecode = createGraphNodeFromObjectSpec(
      "[decode]",
      [],
      nodeRegistry.filter((definition) => definition.id !== "core.video-decode")
    );

    expect(missingDecode.ok).toBe(false);
    expect(missingDecode.node).toMatchObject({
      kind: OBJECT_DISPLAY_KIND,
      objectSpec: "decode",
      objectResolution: {
        status: "unresolved",
        selectedSpec: "decode"
      },
      params: {
        requestedObject: "core.video-decode"
      }
    });
    expect(missingDecode.diagnostics[0]).toMatchObject({
      code: "object-unavailable"
    });
  });

  it("mirrors native alias port activation and defaults into parse results", () => {
    const registryWithDefault = nodeRegistry.map((definition): NodeDefinitionManifestV01 => {
      if (definition.id !== "core.video-decode") {
        return definition;
      }
      return {
        ...definition,
        ports: definition.ports.map((port, index) =>
          index === 0
            ? {
                ...port,
                defaultValue: "fixture",
                triggerMode: "latched"
              }
            : port
        )
      };
    });

    const result = createGraphNodeFromObjectSpec("[decode]", [], registryWithDefault);

    expect(result.ok).toBe(true);
    expect(result.parseResult.displayText).toBe("decode");
    expect(result.parseResult.instancePorts[0]).toMatchObject({
      activation: "latched",
      defaultValue: "fixture"
    });
  });

  it("falls back from blank object spec to label and kind display text", () => {
    const node: GraphNodeV01 = {
      id: "sensor_1",
      kind: "user.sensor",
      kindVersion: "0.1.0",
      params: {},
      ports: []
    };

    expect(genericObjectSpecForNode({ ...node, objectSpec: "  ", params: { label: "Temperature" } })).toBe("Temperature");
    expect(genericObjectSpecForNode({ ...node, objectSpec: "  ", params: { label: " " } })).toBe("user.sensor");
  });

  it("keeps unresolved namespace-free object specs editable for package authoring", () => {
    const extension = createGraphNodeFromObjectSpec("user.manipulator", [], nodeRegistry);
    const unknown = createGraphNodeFromObjectSpec("manipulator", [], nodeRegistry);

    expect(extension.ok).toBe(false);
    expect(extension.node).toMatchObject({
      kind: OBJECT_DISPLAY_KIND,
      objectSpec: "user.manipulator",
      objectResolution: {
        status: "unresolved",
        selectedSpec: "user.manipulator",
        diagnostics: [{ code: "resolution-unresolved" }]
      },
      params: {
        requestedObject: "user.manipulator"
      }
    });
    expect(extension.diagnostics[0]).toMatchObject({
      code: "object-unresolved"
    });
    expect(unknown.node).toMatchObject({
      kind: OBJECT_DISPLAY_KIND,
      objectSpec: "manipulator",
      objectResolution: {
        status: "unresolved",
        selectedSpec: "manipulator",
        diagnostics: [{ code: "resolution-unresolved" }]
      },
      params: {
        requestedObject: "manipulator"
      }
    });
    expect(unknown.diagnostics[0]).toMatchObject({
      code: "object-unresolved"
    });
  });

  it("resolves p object spec through the internal patch library", () => {
    const patch = {
      id: "voice",
      revision: "1",
      metadata: {
        title: "Voice",
        description: "Reusable synth voice."
      },
      graph: {
        schema: "skenion.graph",
        schemaVersion: "0.1.0",
        id: "voice-help",
        revision: "1",
        nodes: [
          {
            id: "pitch_in",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: { portId: "pitch", label: "Pitch" },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float",
                rate: "control",
                triggerMode: "latched",
                defaultValue: 69,
                description: "Pitch in MIDI note numbers."
              }
            ]
          },
          {
            id: "audio_out",
            kind: "core.outlet",
            kindVersion: "0.1.0",
            params: { portId: "out", label: "Out" },
            ports: [
              {
                id: "in",
                direction: "input",
                type: "signal.audio",
                rate: "audio",
                description: "Generated audio signal."
              }
            ]
          }
        ],
        edges: []
      }
    } as unknown as PatchDefinitionV01;
    const result = createGraphNodeFromObjectSpec("p voice", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([patch])
    });

    expect(result.ok).toBe(true);
    expect(result.node).toMatchObject({
      id: "voice_1",
      kind: "core.subpatch",
      kindVersion: "0.1.0",
      objectSpec: "p voice",
      params: {
        label: "p voice",
        patchId: "voice",
        patchRevision: "1",
        description: "Reusable synth voice."
      },
      ports: [
        {
          id: "pitch",
          direction: "input",
          type: { flow: "control", dataKind: "number.float", format: "f32" },
          activation: "latched",
          description: "Pitch in MIDI note numbers."
        },
        {
          id: "out",
          direction: "output",
          type: { flow: "signal", dataKind: "signal.audio" },
          description: "Generated audio signal."
        }
      ]
    });
    expect(result.parseResult).toMatchObject({
      ok: true,
      className: "p",
      creationArgs: [{ type: "identifier", value: "voice" }],
      implementation: {
        provider: { kind: "projectPatch", patchId: "voice" },
        objectId: "voice"
      },
      objectResolution: {
        status: "resolved",
        selectedSpec: "p voice"
      },
      params: { patchId: "voice" },
      instancePorts: [
        {
          id: "pitch",
          direction: "input",
          type: "number.float",
          defaultValue: 69,
          description: "Pitch in MIDI note numbers."
        },
        { id: "out", direction: "output", type: "signal.audio", description: "Generated audio signal." }
      ]
    });
  });

  it("derives subpatch ports from legacy object.core boundary nodes when contracts cannot", () => {
    const patch = {
      id: "legacy",
      revision: "1",
      metadata: {},
      graph: {
        schema: "skenion.graph",
        schemaVersion: "0.1.0",
        id: "legacy-help",
        revision: "1",
        nodes: [
          {
            id: "legacy_in",
            kind: "object.core.inlet",
            kindVersion: "0.1.0",
            params: { label: "Legacy In" },
            ports: [
              {
                id: "left",
                direction: "output",
                type: "number.float"
              },
              {
                id: "right",
                direction: "output",
                type: "number.float"
              }
            ]
          },
          {
            id: "ignored",
            kind: "object.core.comment",
            kindVersion: "0.1.0",
            params: {},
            ports: []
          },
          {
            id: "legacy_out",
            kind: "object.core.outlet",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "in",
                direction: "input",
                type: "signal.audio"
              }
            ]
          }
        ],
        edges: []
      }
    } as unknown as PatchDefinitionV01;

    const result = createGraphNodeFromObjectSpec("p legacy", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([patch])
    });

    expect(result.ok).toBe(true);
    expect(result.parseResult.instancePorts.map((port) => [port.id, port.direction, port.type])).toEqual([
      ["left", "input", "number.float"],
      ["right", "input", "number.float"],
      ["legacy_out", "output", "signal.audio"]
    ]);
  });

  it("keeps optional subpatch parse metadata absent for bare boundary ports", () => {
    const patch = {
      id: "bare",
      revision: "1",
      graph: {
        schema: "skenion.graph",
        schemaVersion: "0.1.0",
        id: "bare-help",
        revision: "1",
        nodes: [
          {
            id: "input",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: { portId: "in" },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "message.any"
              }
            ]
          }
        ],
        edges: []
      }
    } as unknown as PatchDefinitionV01;
    const result = createGraphNodeFromObjectSpec("p bare", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([patch])
    });

    expect(result.ok).toBe(true);
    expect(result.parseResult.instancePorts[0]).toEqual({
      id: "in",
      direction: "input",
      type: "message.any"
    });
  });

  it("keeps missing patch references editable as unresolved object nodes", () => {
    const missingLibrary = createGraphNodeFromObjectSpec("p missing", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([])
    });
    const unavailableLibrary = createGraphNodeFromObjectSpec("p missing", [], nodeRegistry);

    expect(missingLibrary.ok).toBe(false);
    expect(missingLibrary.node).toMatchObject({
      kind: OBJECT_DISPLAY_KIND,
      objectSpec: "p missing",
      objectResolution: {
        status: "unresolved",
        selectedSpec: "p missing",
        diagnostics: [{ code: "resolution-unresolved" }]
      },
      params: {
        requestedObject: "core.subpatch"
      }
    });
    expect(missingLibrary.diagnostics[0]).toMatchObject({
      code: "patch-definition-unavailable"
    });
    expect(unavailableLibrary.diagnostics[0]).toMatchObject({
      code: "patch-library-unavailable"
    });

    const missingPatchId = createGraphNodeFromObjectSpec("p", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([])
    });
    const tooManyArgs = createGraphNodeFromObjectSpec("p voice extra", [], nodeRegistry, {
      patchLibrary: createPatchLibrary([])
    });

    expect(missingPatchId.diagnostics[0]).toMatchObject({
      code: "missing-subpatch-id"
    });
    expect(tooManyArgs.diagnostics[0]).toMatchObject({
      code: "invalid-subpatch-object-spec"
    });
  });

  it("creates unique ids when object spec adds repeated operator nodes", () => {
    const first = createGraphNodeFromObjectSpec("+ 1", []);
    const second = createGraphNodeFromObjectSpec("+ 2", [first.node!]);
    const third = createGraphNodeFromObjectSpec("+ 3", [first.node!, { ...second.node!, id: "add_3" }]);

    expect(first.node?.id).toBe("add_1");
    expect(second.node?.id).toBe("add_2");
    expect(third.node?.id).toBe("add_4");
  });

  it("maps object spec type strings to graph data types", () => {
    expect(objectSpecTypeToGraphType("message.any")).toEqual({ flow: "event", dataKind: "message.any" });
    expect(objectSpecTypeToGraphType("event.bang")).toEqual({ flow: "event", dataKind: "event.bang" });
    expect(objectSpecTypeToGraphType("signal.audio")).toEqual({ flow: "signal", dataKind: "signal.audio" });
    expect(objectSpecTypeToGraphType("asset.video")).toEqual({ flow: "resource", dataKind: "asset.video" });
    expect(objectSpecTypeToGraphType("video.frame")).toEqual({ flow: "stream", dataKind: "video.frame" });
    expect(objectSpecTypeToGraphType("number.int")).toEqual({ flow: "control", dataKind: "number.int", format: "i32" });
    expect(objectSpecTypeToGraphType("number.uint")).toEqual({ flow: "control", dataKind: "number.uint", format: "u32" });
    expect(objectSpecTypeToGraphType("color")).toEqual({ flow: "control", dataKind: "color", format: "rgba32f" });
  });

  it("reports unavailable object kinds when registry lookup fails", () => {
    const parseResult = createGraphNodeFromObjectSpec("+ 1", []).parseResult;
    const missingKindResult = createGraphNodeFromObjectSpec(
      "+ 1",
      [],
      nodeRegistry.filter((definition) => definition.id !== "core.operator.add")
    );

    expect(objectSpecRegistryDiagnostic(parseResult, [])).toBeNull();
    expect(objectSpecRegistryDiagnostic({ ...parseResult, ok: false }, nodeRegistry)).toBeNull();
    expect(objectSpecRegistryDiagnostic(parseResult, nodeRegistry.filter((definition) => definition.id !== "core.operator.add"))).toMatchObject({
      code: "object-unavailable"
    });
    expect(missingKindResult).toMatchObject({
      ok: false,
      node: {
        kind: OBJECT_DISPLAY_KIND,
        objectResolution: {
          status: "unresolved"
        },
        params: {
          requestedObject: "core.operator.add"
        }
      }
    });
    expect(missingKindResult.diagnostics.at(-1)).toMatchObject({
      code: "object-unavailable"
    });
  });

  it("does not reject parser-owned dynamic ports against static registry ports", () => {
    const parseResult = createGraphNodeFromObjectSpec("+ 1", []).parseResult;
    const definition = nodeRegistry.find((candidate) => candidate.id === "core.operator.add")!;

    expect(objectSpecRegistryDiagnostic(parseResult, [{ ...definition, ports: definition.ports.slice(0, 2) }])).toBeNull();
  });

  it("keeps only graph-supported activation values", () => {
    expect(
      objectSpecPortToGraphPort({
        id: "passive",
        direction: "input",
        type: "number.float",
        activation: "passive"
      })
    ).not.toHaveProperty("activation");
  });
});
