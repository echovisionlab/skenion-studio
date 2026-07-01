import { describe, expect, it } from "vitest";
import type { ObjectImplementationRefV01 } from "@skenion/contracts";
import type { PatchDefinitionV01 } from "./patchLibrary";
import {
  createPatchLibrary,
  createSubpatchNodeFromDefinition,
  findPatchDefinition,
  displayGraphToContractGraph,
  contractGraphToDisplayGraph,
  graphPortToPortSpec,
  isPatchDefinition,
  patchDisplayName,
  patchDefinitionToDisplayGraph,
  patchTags,
  portSpecToGraphPort,
  SUBPATCH_NODE_KIND
} from "./patchLibrary";

describe("patchLibrary", () => {
  it("models and looks up internal current 0.1 patch definitions", () => {
    const patch = testPatchDefinition();
    const library = createPatchLibrary([patch]);

    expect(library).toEqual({ patches: [patch] });
    expect(isPatchDefinition(patch)).toBe(true);
    expect(isPatchDefinition({})).toBe(false);
    expect(findPatchDefinition(library, "voice")).toBe(patch);
    expect(findPatchDefinition(undefined, "voice")).toBeNull();
    expect(findPatchDefinition(library, "missing")).toBeNull();
    expect(patchDisplayName(patch)).toBe("Voice");
    expect(patchDisplayName({ ...patch, metadata: { title: "  " } })).toBe("voice");
    expect(patchTags(patch)).toEqual(["patch"]);
    expect(patchTags({ ...patch, metadata: { tags: ["patch", 3] } })).toEqual(["patch"]);
    expect(patchTags({ ...patch, metadata: {} })).toEqual([]);
  });

  it("ignores malformed legacy boundary nodes when deriving patch contracts", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
        nodes: [
          {
            id: "broken_inlet",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "in",
                direction: "input",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports).toEqual([]);
  });

  it("ignores non-boundary legacy nodes when deriving patch contracts", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
        nodes: [
          {
            id: "ordinary_legacy",
            kind: "core.float",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "value",
                direction: "output",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports).toEqual([]);
  });

  it("falls back to legacy boundary node ids when labels and port ids are absent", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
        nodes: [
          {
            id: "bare_inlet",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: {},
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports[0]).toMatchObject({
      id: "bare_inlet",
      label: "Bare Inlet"
    });

    const noParamsPatch: PatchDefinitionV01 = {
      ...patch,
      graph: {
        ...patch.graph,
        nodes: [
          {
            id: "no_params_inlet",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"]
      }
    };
    expect(createSubpatchNodeFromDefinition(noParamsPatch, []).ports[0]).toMatchObject({
      id: "no_params_inlet",
      label: "No Params Inlet"
    });
  });

  it("ignores malformed legacy boundary label and port id params", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
        nodes: [
          {
            id: "fallback_inlet",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: {
              label: 7,
              portId: "  ",
              externalPortId: 9
            },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports[0]).toMatchObject({
      id: "fallback_inlet",
      label: "Fallback Inlet"
    });
  });

  it("uses non-empty legacy boundary port id params", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
        nodes: [
          {
            id: "renamed_inlet",
            kind: "core.inlet",
            kindVersion: "0.1.0",
            params: {
              portId: "pitch_in"
            },
            ports: [
              {
                id: "out",
                direction: "output",
                type: "number.float"
              }
            ]
          }
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports[0]).toMatchObject({
      id: "pitch_in",
      label: "Pitch In"
    });
  });

  it("derives legacy object.core boundary ports in the patch library boundary owner", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      graph: {
        ...testPatchDefinition().graph,
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
        ] as unknown as PatchDefinitionV01["graph"]["nodes"],
        edges: []
      }
    };

    expect(createSubpatchNodeFromDefinition(patch, []).ports.map((port) => [port.id, port.direction, port.type])).toEqual([
      ["left", "input", { flow: "control", dataKind: "number.float", format: "f32" }],
      ["right", "input", { flow: "control", dataKind: "number.float", format: "f32" }],
      ["legacy_out", "output", { flow: "signal", dataKind: "signal.audio" }]
    ]);
  });

  it("creates a core.subpatch node from patch boundary ports", () => {
    const patch = testPatchDefinition();
    const node = createSubpatchNodeFromDefinition(patch, [], { objectSpec: "p voice" });

    expect(node).toMatchObject({
      id: "voice_1",
      kind: SUBPATCH_NODE_KIND,
      kindVersion: "0.1.0",
      objectSpec: "p voice",
      implementation: {
        provider: {
          kind: "projectPatch",
          patchId: "voice",
          revision: "3"
        },
        objectId: "voice",
        version: "3"
      },
      objectResolution: {
        status: "resolved",
        selectedSpec: "p voice"
      },
      params: {
        label: "p voice",
        patchId: "voice",
        patchRevision: "3",
        description: "Simple reusable voice."
      }
    });
    expect(node.ports).toEqual([
      {
        id: "pitch",
        direction: "input",
        label: "Pitch",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        required: true,
        rate: "control",
        accepts: ["number.int"],
        minConnections: 1,
        maxConnections: 1,
        mergePolicy: "forbid",
        triggerMode: "latched",
        description: "Pitch in MIDI note numbers.",
        activation: "latched"
      },
      {
        id: "audio",
        direction: "output",
        label: "Audio",
        type: { flow: "signal", dataKind: "signal.audio" },
        required: false,
        rate: "audio",
        fanOutPolicy: "allow",
        description: "Generated audio signal."
      }
    ]);

    const collision = createSubpatchNodeFromDefinition(patch, [{ ...node, id: "voice_2" }], { objectSpec: "p voice" });
    expect(collision.id).toBe("voice_3");
  });

  it("omits optional subpatch node metadata when the patch does not provide it", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      metadata: { title: "  ", description: "  " }
    };
    const node = createSubpatchNodeFromDefinition(patch, [], {
      nodeId: "custom_voice",
      objectSpec: "p voice"
    });

    expect(node.id).toBe("custom_voice");
    expect(node.params).not.toHaveProperty("description");
  });

  it("uses default object spec and a fallback node id for symbolic patch ids", () => {
    const patch: PatchDefinitionV01 = {
      ...testPatchDefinition(),
      id: "---"
    };
    const node = createSubpatchNodeFromDefinition(patch, []);

    expect(node.id).toBe("subpatch_1");
    expect(node.params.label).toBe("p ---");
    expect(node.objectSpec).toBe("p ---");
  });

  it("maps standalone current 0.1 color ports through the v0.1 display adapter", () => {
    expect(
      portSpecToGraphPort({
        id: "tint",
        direction: "input",
        type: "color",
        rate: "control"
      })
    ).toMatchObject({
      id: "tint",
      type: { flow: "control", dataKind: "color", format: "rgba32f" }
    });

    expect(
      portSpecToGraphPort({
        id: "count",
        direction: "input",
        type: "number.int",
        rate: "control"
      }).type
    ).toEqual({ flow: "control", dataKind: "number.int", format: "i32" });
    expect(
      portSpecToGraphPort({
        id: "index",
        direction: "input",
        type: "value.core.uint32",
        rate: "control"
      }).type
    ).toEqual({ flow: "control", dataKind: "number.int", format: "u32" });
    expect(
      portSpecToGraphPort({
        id: "asset",
        direction: "output",
        type: "resource.asset.video",
        rate: "resource"
      }).type
    ).toEqual({ flow: "resource", dataKind: "asset.video" });
    expect(
      portSpecToGraphPort({
        id: "mesh",
        direction: "output",
        type: "resource.buffer.mesh",
        rate: "resource"
      }).type
    ).toEqual({ flow: "resource", dataKind: "buffer.mesh" });
    expect(
      portSpecToGraphPort({
        id: "frame",
        direction: "output",
        type: "video.frame"
      }).type
    ).toEqual({ flow: "stream", dataKind: "video.frame" });
    expect(
      portSpecToGraphPort({
        id: "velocity",
        direction: "input",
        type: "value.velocity"
      }).type
    ).toEqual({ flow: "control", dataKind: "velocity" });
    expect(
      portSpecToGraphPort({
        id: "audio",
        direction: "output",
        type: "media.audio-stream"
      }).type
    ).toEqual({ flow: "signal", dataKind: "signal.audio" });
    expect(
      portSpecToGraphPort({
        id: "custom-video",
        direction: "output",
        type: "media.video-frame"
      }).type
    ).toEqual({ flow: "stream", dataKind: "video.frame" });
    expect(
      portSpecToGraphPort({
        id: "message",
        direction: "input",
        type: "value.core.message"
      }).type
    ).toEqual({ flow: "event", dataKind: "message.any" });
    expect(
      portSpecToGraphPort({
        id: "string",
        direction: "input",
        type: "value.core.string"
      }).type
    ).toEqual({ flow: "control", dataKind: "string" });
    expect(
      portSpecToGraphPort({
        id: "count-u8",
        direction: "input",
        type: "value.core.uint8"
      }).type
    ).toEqual({ flow: "control", dataKind: "number.int", format: "u8" });
    expect(
      portSpecToGraphPort({
        id: "depth",
        direction: "input",
        type: "stream.depth"
      }).type
    ).toEqual({ flow: "stream", dataKind: "depth" });
    expect(
      portSpecToGraphPort({
        id: "latched",
        direction: "input",
        type: "message.any",
        latch: true
      }).activation
    ).toBe("latched");
  });

  it("maps display-only v0.1 port type hints back into current 0.1 port specs", () => {
    const graph = displayGraphToContractGraph({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "port-types",
      revision: "1",
      nodes: [
        {
          id: "types",
          kind: "core.types",
          kindVersion: "0.1.0",
          params: {},
          ports: [
            {
              id: "audio",
              direction: "output",
              type: { flow: "signal", dataKind: "signal.audio" }
            },
            {
              id: "buffer",
              direction: "output",
              type: { flow: "resource", dataKind: "buffer.mesh" }
            },
            {
              id: "frame",
              direction: "output",
              type: { flow: "resource", dataKind: "render.frame" }
            },
            {
              id: "custom",
              direction: "input",
              type: { flow: "control", dataKind: "custom.scalar" }
            }
          ]
        }
      ],
      edges: []
    });

    expect(graph.nodes[0]?.ports.map((port) => ({ id: port.id, rate: port.rate, type: port.type }))).toEqual([
      { id: "audio", rate: "audio", type: "media.audio-stream" },
      { id: "buffer", rate: "resource", type: "resource.buffer.mesh" },
      { id: "frame", rate: "render", type: "render.frame" },
      { id: "custom", rate: "control", type: "value.custom.scalar" }
    ]);
    expect(
      graphPortToPortSpec({
        id: "fallback-default",
        direction: "input",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        defaultValue: 0.5
      } as Parameters<typeof graphPortToPortSpec>[0] & { defaultValue: number }).defaultValue
    ).toBe(0.5);
    expect(
      graphPortToPortSpec({
        id: "legacy-default",
        direction: "input",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        default: 0.75
      }).defaultValue
    ).toBe(0.75);
    expect(
      graphPortToPortSpec({
        id: "canonical-float",
        direction: "input",
        type: { flow: "control", dataKind: "number.float", format: "f32" }
      }).type
    ).toBe("value.core.float32");
    expect(
      graphPortToPortSpec({
        id: "display-accepts",
        direction: "input",
        type: { flow: "control", dataKind: "number.float", format: "f32" },
        accepts: [
          "boolean",
          "color",
          "message.any",
          "value.core.uint32",
          "string",
          "signal.audio",
          "video.frame",
          "asset.video",
          "gpu.texture2d"
        ]
      } as Parameters<typeof graphPortToPortSpec>[0] & { accepts: string[] }).accepts
    ).toEqual([
      "value.core.bool",
      "value.core.color",
      "value.core.message",
      "value.core.uint32",
      "value.core.string",
      "media.audio-stream",
      "media.video-frame",
      "resource.asset.video",
      "resource.gpu.texture2d"
    ]);
    expect(
      (portSpecToGraphPort({
        id: "message-in",
        direction: "input",
        type: "value.core.message",
        accepts: [
          "value.core.int32",
          "value.core.uint32",
          "value.core.uint64",
          "value.core.float32",
          "value.core.float64"
        ]
      }) as ReturnType<typeof portSpecToGraphPort> & { accepts: string[] }).accepts
    ).toEqual(["number.int", "number.float"]);
    expect(
      graphPortToPortSpec({
        id: "message-in",
        direction: "input",
        type: { flow: "event", dataKind: "message.any" },
        accepts: ["number.int", "number.int", "number.float", "number.float"]
      } as Parameters<typeof graphPortToPortSpec>[0] & { accepts: string[] }).accepts
    ).toEqual(["value.core.int32", "value.core.float32"]);
    expect(
      graphPortToPortSpec({
        id: "message",
        direction: "input",
        type: { flow: "control", dataKind: "message.any" }
      }).type
    ).toBe("value.core.message");
    expect(
      graphPortToPortSpec({
        id: "integer",
        direction: "input",
        type: { flow: "control", dataKind: "number.int", format: "i16" }
      }).type
    ).toBe("value.core.int16");
    expect(
      graphPortToPortSpec({
        id: "unsigned",
        direction: "input",
        type: { flow: "control", dataKind: "number.int", format: "u16" }
      }).type
    ).toBe("value.core.uint16");
    expect(
      graphPortToPortSpec({
        id: "string",
        direction: "input",
        type: { flow: "control", dataKind: "string" }
      }).type
    ).toBe("value.core.string");
    expect(
      graphPortToPortSpec({
        id: "depth",
        direction: "output",
        type: { flow: "stream", dataKind: "depth" }
      }).type
    ).toBe("stream.depth");
  });

  it("converts current 0.1 graphs to readonly v0.1 display graphs", () => {
    const patch = testPatchDefinition();
    const graph = patchDefinitionToDisplayGraph(patch);

    expect(graph).toMatchObject({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "voice-help",
      revision: "3"
    });
    expect(graph.nodes[1]?.ports[0]).toMatchObject({
      id: "bang",
      type: { flow: "event", dataKind: "event.bang" },
      triggerMode: "trigger",
      description: "Start the envelope."
    });
    expect((graph.nodes[1] as typeof graph.nodes[number] & { portGroups?: unknown }).portGroups).toEqual([
      { id: "control", direction: "output", type: "event.bang", minPorts: 1, label: "Control" }
    ]);
    expect(graph.nodes[3]?.ports[0]).toMatchObject({
      id: "out",
      type: { flow: "resource", dataKind: "render.frame" },
      rate: "render",
      description: "Rendered frame."
    });
    expect(graph.edges[0]).toMatchObject({
      from: { node: "trigger", port: "bang" },
      to: { node: "display", port: "out" },
      id: "edge_trigger_display",
      label: "demo",
      feedback: { enabled: true, boundary: "render-frame" }
    });
  });

  it("converts bare current 0.1 graph documents for helper consumers", () => {
    const graph = contractGraphToDisplayGraph(testPatchDefinition().graph);
    const plainEdgeGraph = contractGraphToDisplayGraph({
      ...testPatchDefinition().graph,
      edges: [
        {
          id: "plain_edge",
          source: { nodeId: "trigger", portId: "bang" },
          target: { nodeId: "display", portId: "out" }
        }
      ]
    });

    expect(graph.nodes.map((node) => node.id)).toEqual(["pitch_in", "trigger", "audio_out", "display"]);
    expect(plainEdgeGraph.edges[0]).not.toHaveProperty("feedback");
  });

  it("bridges Runtime implementation identity to display kinds without persisting legacy identity", () => {
    const graph = contractGraphToDisplayGraph({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "runtime-owned",
      revision: "1",
      nodes: [
        {
          id: "float_1",
          implementation: {
            provider: { kind: "core" },
            objectId: "float",
            version: "0.1.0"
          },
          objectSpec: "float",
          objectResolution: {
            status: "resolved",
            selectedSpec: "float",
            candidates: []
          },
          params: {},
          ports: []
        },
        {
          id: "package_1",
          implementation: {
            provider: { kind: "package", packageId: "example/package", version: "0.1.0" },
            objectId: "gain",
            version: "0.1.0"
          },
          objectSpec: "gain",
          bindingRef: "binding_1",
          objectResolution: {
            status: "resolved",
            selectedSpec: "gain",
            candidates: []
          },
          params: {},
          ports: []
        },
        {
          id: "unknown_core_1",
          implementation: {
            provider: { kind: "core" },
            objectId: "unknown",
            version: "0.1.0"
          },
          objectSpec: "unknown",
          params: {},
          ports: []
        }
      ],
      edges: []
    } as unknown as Parameters<typeof contractGraphToDisplayGraph>[0]);

    expect(graph.nodes[0]).toMatchObject({
      kind: "core.float",
      objectSpec: "float"
    });
    expect(graph.nodes[1]).toMatchObject({
      kind: "object.external",
      objectSpec: "gain",
      bindingRef: "binding_1"
    });
    expect(graph.nodes[2]).toMatchObject({
      kind: "object.core",
      objectSpec: "unknown"
    });

    const contractGraph = displayGraphToContractGraph(graph);
    expect(contractGraph.nodes[0]).not.toHaveProperty("kind");
    expect(contractGraph.nodes[0]).not.toHaveProperty("kindVersion");
    expect(contractGraph.nodes[0]).toMatchObject({
      implementation: {
        provider: { kind: "core" },
        objectId: "float"
      },
      objectSpec: "float"
    });
  });

  it("keeps display graph fallbacks for unresolved, project patch, and legacy runtime core kinds", () => {
    const graph = contractGraphToDisplayGraph({
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "display-fallbacks",
      revision: "1",
      nodes: [
        {
          id: "legacy_keep",
          kind: "core.float",
          kindVersion: "2.0.0",
          params: {},
          ports: []
        },
        {
          id: "legacy_core",
          kind: "object.core.float",
          kindVersion: "",
          params: {},
          ports: []
        },
        {
          id: "unresolved",
          params: {},
          ports: []
        },
        {
          id: "project_patch",
          implementation: {
            provider: { kind: "projectPatch", patchId: "voice", revision: "1" },
            objectId: "voice",
            version: "1"
          },
          objectSpec: "p voice",
          params: {},
          ports: []
        }
      ],
      edges: []
    } as unknown as Parameters<typeof contractGraphToDisplayGraph>[0]);

    expect(graph.nodes.map((node) => [node.id, node.kind, node.kindVersion])).toEqual([
      ["legacy_keep", "core.float", "2.0.0"],
      ["legacy_core", "core.float", "0.1.0"],
      ["unresolved", "object", "0.1.0"],
      ["project_patch", "core.subpatch", "1"]
    ]);
  });

  it("converts display graphs back into active current 0.1 graphs without losing metadata", () => {
    const displayGraph = patchDefinitionToDisplayGraph(testPatchDefinition());
    const activeGraph = displayGraphToContractGraph(displayGraph);

    expect(activeGraph.schemaVersion).toBe("0.1.0");
    expect(activeGraph.nodes[1]?.ports[0]).toMatchObject({
      id: "bang",
      type: "value.core.bang",
      rate: "event",
      triggerMode: "trigger",
      description: "Start the envelope."
    });
    expect(activeGraph.nodes[1]?.portGroups).toEqual([
      { id: "control", direction: "output", type: "value.core.bang", minPorts: 1, label: "Control" }
    ]);
    expect(activeGraph.edges[0]).toMatchObject({
      id: "edge_trigger_display",
      source: { nodeId: "trigger", portId: "bang" },
      target: { nodeId: "display", portId: "out" },
      label: "demo",
      feedback: { enabled: true, boundary: "render-frame" }
    });
  });
});

function testPatchDefinition(): PatchDefinitionV01 {
  return {
    id: "voice",
    revision: "3",
    metadata: {
      title: "Voice",
      description: "Simple reusable voice.",
      tags: ["patch"]
    },
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "voice-help",
      revision: "3",
      nodes: [
        {
          id: "pitch_in",
          ...coreNodeIdentity("inlet", "inlet"),
          params: { portId: "pitch", label: "Pitch" },
          ports: [
            {
              id: "out",
              direction: "output",
              type: "value.core.float32",
              rate: "control",
              accepts: ["value.core.int32"],
              minConnections: 1,
              maxConnections: 1,
              mergePolicy: "forbid",
              triggerMode: "latched",
              description: "Pitch in MIDI note numbers."
            }
          ]
        },
        {
          id: "trigger",
          ...coreNodeIdentity("bang", "bang"),
          params: { label: "Trigger" },
          portGroups: [{ id: "control", direction: "output", type: "value.core.bang", minPorts: 1, label: "Control" }],
          ports: [
            {
              id: "bang",
              direction: "output",
              type: "value.core.bang",
              rate: "event",
              triggerMode: "trigger",
              description: "Start the envelope."
            }
          ]
        },
        {
          id: "audio_out",
          ...coreNodeIdentity("outlet", "outlet"),
          params: { portId: "audio", label: "Audio" },
          ports: [
            {
              id: "in",
              direction: "input",
              type: "signal.audio",
              rate: "audio",
              fanOutPolicy: "allow",
              description: "Generated audio signal."
            }
          ]
        },
        {
          id: "display",
          ...coreNodeIdentity("render.output", "render-output"),
          params: { label: "Output" },
          ports: [
            {
              id: "out",
              direction: "input",
              type: "render.frame",
              rate: "render",
              description: "Rendered frame."
            }
          ]
        }
      ],
      edges: [
        {
          id: "edge_trigger_display",
          source: { nodeId: "trigger", portId: "bang" },
          target: { nodeId: "display", portId: "out" },
          feedback: { enabled: true, boundary: "render-frame" },
          label: "demo"
        }
      ]
    }
  };
}

function coreNodeIdentity(objectId: string, objectSpec: string) {
  const implementation = {
    provider: { kind: "core" },
    objectId,
    version: "0.1.0"
  } satisfies ObjectImplementationRefV01;
  return {
    implementation,
    objectSpec,
    objectResolution: {
      status: "resolved" as const,
      selectedSpec: objectSpec,
      candidates: [
        {
          implementation,
          objectSpec
        }
      ]
    }
  };
}
