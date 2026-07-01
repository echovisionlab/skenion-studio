import type { NodeDefinitionManifestV01, PortSpecV01 } from "@skenion/contracts";

type ExecutionModel = NodeDefinitionManifestV01["execution"]["model"];
type ExecutionClock = NonNullable<NodeDefinitionManifestV01["execution"]["clock"]>;

interface DefinitionOptions {
  id: string;
  displayName: string;
  category: string;
  ports: PortSpecV01[];
  model?: ExecutionModel;
  clock?: ExecutionClock;
  palette?: boolean;
  capabilities?: string[];
}

export const studioBuiltinNodeDefinitionsV01: NodeDefinitionManifestV01[] = [
  valueDefinition("core.float", "Float", "value.core.float32"),
  valueDefinition("core.int", "Int", "value.core.int32"),
  valueDefinition("core.uint", "UInt", "value.core.uint32"),
  valueDefinition("core.bool", "Bool", "value.core.bool"),
  valueDefinition("core.color", "Color", "value.core.color", "Color"),
  valueDefinition("core.string", "String", "value.core.string"),
  defineNode({
    id: "core.message",
    displayName: "Message",
    category: "Control",
    palette: true,
    model: "event",
    ports: [messageInput("in", "In"), output("out", "Message", "value.core.message")]
  }),
  defineNode({
    id: "core.bang",
    displayName: "Bang",
    category: "Events",
    palette: true,
    model: "event",
    ports: [messageInput("in", "In"), output("out", "Bang", "value.core.bang")]
  }),
  defineNode({
    id: "core.comment",
    displayName: "Comment",
    category: "Control",
    palette: true,
    model: "event",
    ports: [messageInput("in", "In")]
  }),
  defineNode({
    id: "core.panel",
    displayName: "Panel",
    category: "Control",
    palette: true,
    ports: [messageInput("in", "In")]
  }),
  defineNode({
    id: "core.operator.add",
    displayName: "Add",
    category: "Operators",
    capabilities: ["pd.control.operator.v0.1"],
    ports: [
      messageInput("in", "In"),
      optionalInput("right", "Right", "value.core.float32"),
      output("out", "Value", "value.core.float32")
    ]
  }),
  defineNode({
    id: "audio.operator.mul",
    displayName: "Audio Multiply",
    category: "Audio",
    model: "audio_block",
    clock: "audio",
    capabilities: ["pd.audio.operator.v0.1"],
    ports: [
      optionalInput("left", "Left", "signal.audio"),
      optionalInput("right", "Right", "signal.audio"),
      output("out", "Signal", "signal.audio")
    ]
  }),
  defineNode({
    id: "audio.osc",
    displayName: "Oscillator",
    category: "Audio",
    palette: true,
    model: "audio_block",
    clock: "audio",
    capabilities: ["pd.audio.v0.1"],
    ports: [optionalInput("frequency", "Frequency", "value.core.float32"), output("out", "Signal", "signal.audio")]
  }),
  defineNode({
    id: "core.video-asset",
    displayName: "Video Asset",
    category: "Media",
    palette: true,
    model: "async_resource",
    ports: [output("asset", "Asset", "asset.video")]
  }),
  defineNode({
    id: "core.video-decode",
    displayName: "Video Decode",
    category: "Converters",
    palette: true,
    model: "video_frame",
    ports: [requiredInput("asset", "Asset", "asset.video"), output("frames", "Frames", "video.frame")]
  }),
  defineNode({
    id: "core.gpu-upload",
    displayName: "GPU Upload",
    category: "Converters",
    palette: true,
    model: "gpu_pass",
    ports: [requiredInput("frames", "Frames", "video.frame"), output("texture", "Texture", "gpu.texture2d")]
  }),
  defineNode({
    id: "core.preview",
    displayName: "Preview",
    category: "Output",
    palette: true,
    model: "frame",
    ports: [requiredInput("texture", "Texture", "gpu.texture2d")]
  }),
  defineNode({
    id: "render.clear-color",
    displayName: "Clear Color",
    category: "Render",
    palette: true,
    model: "gpu_pass",
    clock: "frame",
    capabilities: ["render.output.clear-color"],
    ports: [output("out", "Out", "gpu.texture2d")]
  }),
  defineNode({
    id: "render.fullscreen-shader",
    displayName: "Fullscreen Shader",
    category: "Render",
    palette: true,
    model: "gpu_pass",
    clock: "frame",
    capabilities: ["render.output.fullscreen-shader"],
    ports: [{ ...output("out", "Out", "value.core.tensor"), rate: "resource" }]
  }),
  defineNode({
    id: "render.output",
    displayName: "Render Output",
    category: "Render",
    palette: true,
    model: "frame",
    clock: "frame",
    capabilities: ["render.output.surface"],
    ports: [{ ...requiredInput("in", "In", "value.core.tensor"), rate: "resource" }]
  })
];

function valueDefinition(
  id: string,
  displayName: string,
  type: string,
  outputLabel = "Value"
): NodeDefinitionManifestV01 {
  return defineNode({
    id,
    displayName,
    category: "Values",
    palette: true,
    ports: [messageInput("in", "In"), optionalInput("cold", "Cold", type), output("value", outputLabel, type)]
  });
}

function defineNode({
  id,
  displayName,
  category,
  ports,
  model = "control",
  clock,
  palette = false,
  capabilities = []
}: DefinitionOptions): NodeDefinitionManifestV01 {
  return {
    schema: "skenion.node.definition",
    schemaVersion: "0.1.0",
    id,
    version: "0.1.0",
    displayName,
    category,
    ...(palette ? { surface: { palette: "direct" as const } } : {}),
    ports,
    execution: {
      model,
      ...(clock ? { clock } : {})
    },
    state: { persistent: false },
    permissions: [],
    capabilities
  };
}

function optionalInput(id: string, label: string, type: string): PortSpecV01 {
  return { id, direction: "input", label, type, required: false };
}

function messageInput(id: string, label: string): PortSpecV01 {
  return {
    id,
    direction: "input",
    label,
    type: "value.core.message",
    required: false,
    triggerMode: "trigger",
    messageKeys: {
      accepted: ["bang", "set", "message"],
      trigger: ["bang"],
      silent: ["set"],
      store: ["set"],
      emit: ["message"]
    }
  };
}

function requiredInput(id: string, label: string, type: string): PortSpecV01 {
  return { id, direction: "input", label, type, required: true };
}

function output(id: string, label: string, type: string): PortSpecV01 {
  return { id, direction: "output", label, type };
}
