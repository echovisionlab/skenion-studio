import type { Meta, StoryObj } from "@storybook/react-vite";
import { getStudioBuiltinNodeHelp, getStudioBuiltinNodeHelpGraph } from "../../data/studioBuiltins";
import { NodeHelp } from "./NodeHelp";

const meta = {
  title: "Help/NodeHelp",
  component: NodeHelp,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ width: 420 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof NodeHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Float: Story = {
  args: {
    help: getRequiredHelp("core.float"),
    helpGraph: getStudioBuiltinNodeHelpGraph("core.float")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Toggle: Story = {
  args: {
    help: getRequiredHelp("core.bool"),
    helpGraph: getStudioBuiltinNodeHelpGraph("core.bool")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Bang: Story = {
  args: {
    help: getRequiredHelp("core.bang"),
    helpGraph: getStudioBuiltinNodeHelpGraph("core.bang")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Message: Story = {
  args: {
    help: getRequiredHelp("core.message"),
    helpGraph: getStudioBuiltinNodeHelpGraph("core.message")
  },
  render: (args) => <NodeHelp {...args} />
};

export const Panel: Story = {
  args: {
    help: getRequiredHelp("core.panel"),
    helpGraph: getStudioBuiltinNodeHelpGraph("core.panel")
  },
  render: (args) => <NodeHelp {...args} />
};

export const FullscreenShader: Story = {
  args: {
    help: getRequiredHelp("render.fullscreen-shader"),
    helpGraph: getStudioBuiltinNodeHelpGraph("render.fullscreen-shader")
  },
  render: (args) => <NodeHelp {...args} />
};

function getRequiredHelp(id: string) {
  const help = getStudioBuiltinNodeHelp(id);
  if (!help) {
    throw new Error(`Missing builtin help ${id}`);
  }
  return help;
}
