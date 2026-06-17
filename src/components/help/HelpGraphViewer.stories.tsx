import type { Meta, StoryObj } from "@storybook/react-vite";
import { getBuiltinNodeHelpGraph } from "@skenion/contracts";
import { HelpGraphViewer } from "./HelpGraphViewer";

const meta = {
  title: "Help/HelpGraphViewer",
  component: HelpGraphViewer,
  parameters: {
    layout: "centered"
  },
  decorators: [
    (Story) => (
      <div style={{ height: 420, width: 760 }}>
        <Story />
      </div>
    )
  ]
} satisfies Meta<typeof HelpGraphViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ValueBangSet: Story = {
  args: {
    graph: getRequiredHelpGraph("core.value-f32")
  },
  render: (args) => <HelpGraphViewer {...args} />
};

export const DynamicShaderInputs: Story = {
  args: {
    graph: getRequiredHelpGraph("render.fullscreen-shader")
  },
  render: (args) => <HelpGraphViewer {...args} />
};

function getRequiredHelpGraph(id: string) {
  const graph = getBuiltinNodeHelpGraph(id);
  if (!graph) {
    throw new Error(`Missing builtin help graph ${id}`);
  }
  return graph;
}
