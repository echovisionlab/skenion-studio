import type { GraphDocumentV01, GraphNodeV01, PortSpecV01 } from "@skenion/contracts";
import { studioBuiltinNodeDefinitionsV01 } from "./studioBuiltinRegistry";

export const studioBuiltinNodeDefinitions = studioBuiltinNodeDefinitionsV01;

export interface StudioBuiltinNodeHelpItemV01 {
  id: string;
  description: string;
}

export interface StudioBuiltinNodeHelpExampleV01 {
  title: string;
  description?: string;
  graph?: string;
}

export interface StudioBuiltinNodeHelpV01 {
  schema: "skenion.node.help";
  schemaVersion: "0.1.0";
  id: string;
  summary: string;
  description: string;
  docsPath?: string;
  helpGraph: string;
  tags: string[];
  runtimeBehavior?: string;
  relatedNodes?: string[];
  ports?: StudioBuiltinNodeHelpItemV01[];
  params?: StudioBuiltinNodeHelpItemV01[];
  example?: StudioBuiltinNodeHelpExampleV01;
}

export const studioBuiltinNodeHelp: StudioBuiltinNodeHelpV01[] = [
  help("core.float", "Stores and emits a floating-point control payload.", {
    description: "Use Float when a patch needs a generic numeric control payload.",
    tags: ["value", "control", "number"],
    runtimeBehavior: "in is the hot inlet: typed values update and emit, bang emits the stored value, and set ... updates silently. cold updates silently.",
    relatedNodes: ["render.fullscreen-shader"],
    ports: [
      { id: "in", description: "Hot inlet: typed values update and emit; bang emits the stored value; set ... updates silently." },
      { id: "cold", description: "Cold inlet: compatible values or set ... update without emitting." },
      { id: "value", description: "Outputs the current value." }
    ],
    params: [
      { id: "value", description: "Saved default numeric value." },
      { id: "sendName", description: "Optional typed channel name updated whenever this object emits." },
      { id: "receiveName", description: "Optional typed channel name used to receive routed updates." },
      { id: "widget", description: "Optional display widget. Use slider for a compact runtime slider object." },
      { id: "representation", description: "Numeric storage/transport representation such as f32, f16, or f8.e4m3." }
    ],
    example: {
      title: "Drive a shader uniform",
      description: "Connect value to a fullscreen shader numeric input, then send runtime in/set/bang events while the preview runs."
    }
  }),
  help("core.bool", "Stores and emits a boolean control value.", {
    description: "Use Bool for an explicit true/false value. Toggle-style widgets flip on bang and emit the new value.",
    tags: ["value", "control", "boolean"],
    runtimeBehavior: "in is the hot inlet. Value-box widgets emit stored value on bang; toggle/checkbox widgets flip and emit on bang. cold updates silently.",
    relatedNodes: ["render.fullscreen-shader"],
    ports: [
      { id: "in", description: "Hot inlet: values update and emit; bang emits or toggles depending on widget; set ... updates silently." },
      { id: "cold", description: "Cold inlet: compatible boolean values or set ... update without emitting." },
      { id: "value", description: "Outputs the current value." }
    ],
    params: [
      { id: "value", description: "Saved default boolean value." },
      { id: "widget", description: "Optional display widget. Use toggle or checkbox for Max/Pd-style boolean toggling." }
    ]
  }),
  help("core.bang", "Emits a discrete bang event.", {
    description: "Bang is the simplest manual trigger object. It emits a bang payload and does not store a value.",
    tags: ["event", "trigger", "control"],
    runtimeBehavior: "Clicking the object or receiving a non-set message on in emits one bang from out.",
    relatedNodes: ["core.float", "core.message"],
    ports: [
      { id: "in", description: "Accepts control messages. Non-set messages convert to a bang trigger; set is silent." },
      { id: "out", description: "Outputs a discrete bang trigger." }
    ]
  }),
  help("core.message", "Emits a saved message payload when clicked or triggered.", {
    description: "Message is a Max/Pd-like message box. Click or bang emits the stored message; set <message> replaces the runtime message silently.",
    tags: ["event", "message", "text"],
    runtimeBehavior: "Click or bang on in emits the saved message payload. set ... on in updates runtime message text without output. Inspector edits are saved graph mutations.",
    relatedNodes: ["core.string"],
    ports: [
      { id: "in", description: "Hot message inlet: bang emits saved payload; set ... updates silently; other messages evaluate the stored payload." },
      { id: "out", description: "Outputs the saved selector plus typed atoms as a message payload." }
    ],
    params: [
      { id: "value", description: "Saved message box text parsed into selector plus atoms at runtime." },
      { id: "sendName", description: "Optional message channel name updated whenever the message emits." },
      { id: "receiveName", description: "Optional message channel name used to receive routed message updates." }
    ]
  }),
  help("core.panel", "Draws a colored background panel on the patch canvas.", {
    description: "Panel is a visual patch annotation object. It receives message events on its inlet; set <hex> updates its runtime color state silently.",
    tags: ["annotation", "panel", "background"],
    runtimeBehavior: "Messages arrive through in. set <hex> updates the runtime panel CSS color text silently. Inspector color edits remain saved graph mutations.",
    relatedNodes: ["core.comment", "core.message"],
    ports: [
      { id: "in", description: "Accepts message payloads. A set #00ff00 message updates the panel CSS color text without output." }
    ],
    params: [
      { id: "color", description: "Optional saved panel color as a CSS hex string. Omit for transparent." },
      { id: "label", description: "Optional panel title text." },
      { id: "receiveName", description: "Optional string channel name used to receive routed CSS color text updates." }
    ]
  }),
  help("render.fullscreen-shader", "Runs a WGSL fullscreen shader pass.", {
    description: "Fullscreen Shader generates instance input ports from @skenion.uniform annotations. Studio analyzes source explicitly; ports do not mutate while the user is typing.",
    docsPath: "docs/nodes/render.fullscreen-shader.md",
    tags: ["render", "shader", "wgsl", "gpu"],
    runtimeBehavior: "Runtime builds a dynamic uniform layout from the synced input ports, generates WGSL support code, and falls back to clear rendering with structured issues on compile failure.",
    relatedNodes: ["core.float", "core.color", "render.output"],
    ports: [
      { id: "out", description: "Outputs the rendered GPU texture resource." }
    ],
    params: [
      { id: "language", description: "Shader language. v0.1 supports wgsl." },
      { id: "source", description: "WGSL source containing optional @skenion.uniform annotations." }
    ]
  }),
  help("render.output", "Selects the GPU texture rendered by the preview window.", {
    description: "Render Output makes the final render source explicit.",
    tags: ["render", "output", "preview"],
    runtimeBehavior: "Consumes one tensor resource and marks it as the session preview/render output.",
    relatedNodes: ["render.clear-color", "render.fullscreen-shader"],
    ports: [
      { id: "in", description: "Receives the tensor resource selected for output." }
    ]
  })
];

export const studioBuiltinNodeHelpGraphs: Array<{ id: string; graph: GraphDocumentV01 }> = [
  {
    id: "core.float",
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "help-core-float",
      revision: "1",
      nodes: [
        coreNode("bang_1", "bang", "bang", {}, [
          port("out", "output", "value.core.bang", { label: "Bang", rate: "event" })
        ]),
        coreNode("float_1", "float", "float", { label: "Float", value: 0.5 }, [
          port("in", "input", "value.core.message", { label: "In", required: false, triggerMode: "trigger" }),
          port("cold", "input", "value.core.float32", { label: "Cold", required: false }),
          port("value", "output", "value.core.float32", { label: "Value" })
        ]),
        coreNode("shader_1", "render.fullscreen-shader", "fullscreen-shader", {
          label: "Fullscreen Shader",
          language: "wgsl",
          source: "// @skenion.uniform speed value.core.float32 default=0.5 label=\"Speed\"\n@fragment\nfn fs_main() -> @location(0) vec4<f32> {\n  return vec4<f32>(skenion.speed, 0.2, 0.9, 1.0);\n}"
        }, [
          port("speed", "input", "value.core.float32", { label: "Speed", required: false }),
          port("out", "output", "value.core.tensor", { label: "Out", rate: "gpu" })
        ]),
        coreNode("output_1", "render.output", "render-output", { label: "Render Output" }, [
          port("in", "input", "value.core.tensor", { label: "In", rate: "gpu", required: true })
        ])
      ],
      edges: [
        edge("edge_bang_float", "bang_1", "out", "float_1", "in"),
        edge("edge_float_shader", "float_1", "value", "shader_1", "speed"),
        edge("edge_shader_output", "shader_1", "out", "output_1", "in")
      ]
    }
  },
  {
    id: "render.fullscreen-shader",
    graph: {
      schema: "skenion.graph",
      schemaVersion: "0.1.0",
      id: "help-render-fullscreen-shader",
      revision: "1",
      nodes: [
        coreNode("float_1", "float", "float", { label: "Speed", value: 0.25 }, [
          port("value", "output", "value.core.float32", { label: "Value" })
        ]),
        coreNode("color_1", "color", "color", { label: "Tint", value: [0.95, 0.25, 0.12, 1] }, [
          port("value", "output", "value.core.color", { label: "Color" })
        ]),
        coreNode("shader_1", "render.fullscreen-shader", "fullscreen-shader", {
          label: "Fullscreen Shader",
          language: "wgsl",
          source: "// @skenion.uniform speed value.core.float32 default=0.25 min=0 max=2 step=0.01 label=\"Speed\"\n// @skenion.uniform tint value.core.color default=[0.95,0.25,0.12,1] label=\"Tint\"\n@fragment\nfn fs_main() -> @location(0) vec4<f32> {\n  return vec4<f32>(mix(vec3<f32>(skenion.speed), skenion.tint.rgb, 0.5), skenion.tint.a);\n}"
        }, [
          port("speed", "input", "value.core.float32", { label: "Speed", required: false }),
          port("tint", "input", "value.core.color", { label: "Tint", required: false }),
          port("out", "output", "value.core.tensor", { label: "Out", rate: "gpu" })
        ]),
        coreNode("output_1", "render.output", "render-output", { label: "Render Output" }, [
          port("in", "input", "value.core.tensor", { label: "In", rate: "gpu", required: true })
        ])
      ],
      edges: [
        edge("edge_float_shader", "float_1", "value", "shader_1", "speed"),
        edge("edge_color_shader", "color_1", "value", "shader_1", "tint"),
        edge("edge_shader_output", "shader_1", "out", "output_1", "in")
      ]
    }
  }
];

export function getStudioBuiltinNodeHelp(id: string): StudioBuiltinNodeHelpV01 | undefined {
  const help = studioBuiltinNodeHelp.find((candidate) => candidate.id === id);
  return help ? cloneJson(help) : undefined;
}

export function getStudioBuiltinNodeHelpGraph(id: string): GraphDocumentV01 | undefined {
  const entry = studioBuiltinNodeHelpGraphs.find((candidate) => candidate.id === id);
  return entry ? cloneJson(entry.graph) : undefined;
}

function help(
  id: string,
  summary: string,
  options: Omit<StudioBuiltinNodeHelpV01, "helpGraph" | "id" | "schema" | "schemaVersion" | "summary">
): StudioBuiltinNodeHelpV01 {
  return {
    schema: "skenion.node.help",
    schemaVersion: "0.1.0",
    id,
    summary,
    helpGraph: `studio-local/${id}.help.graph.json`,
    ...options
  };
}

function port(
  id: string,
  direction: PortSpecV01["direction"],
  type: string,
  options: Omit<PortSpecV01, "direction" | "id" | "type"> = {}
): PortSpecV01 {
  return {
    id,
    direction,
    type,
    ...options
  };
}

function coreNode(
  id: string,
  objectId: string,
  objectSpec: string,
  params: Record<string, unknown>,
  ports: PortSpecV01[]
): GraphNodeV01 {
  return {
    id,
    implementation: {
      provider: { kind: "core" },
      objectId,
      version: "0.1.0"
    },
    objectSpec,
    params,
    ports
  };
}

function edge(id: string, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string) {
  return {
    id,
    source: {
      nodeId: sourceNodeId,
      portId: sourcePortId
    },
    target: {
      nodeId: targetNodeId,
      portId: targetPortId
    }
  };
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
