import type { Meta, StoryObj } from "@storybook/react-vite";
import { PerformanceShell } from "./PerformanceShell";
import {
  sendReceivePanelSampleGraph,
  sendReceivePanelSampleViewState
} from "../../data/sampleGraph";
import {
  noop,
  runtimePreviewStatus,
  runtimeSession,
  runtimeTelemetry,
  runtimeTelemetryWithRenderError
} from "../../stories/storyFixtures";

const meta = {
  title: "Performance/PerformanceShell",
  component: PerformanceShell,
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta<typeof PerformanceShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SendReceivePanel: Story = {
  args: {
    busyAction: null,
    controlEnabled: true,
    error: null,
    graph: sendReceivePanelSampleGraph,
    onConnect: noop,
    onLoadSession: noop,
    onRestartPreview: noop,
    onSendRuntimeControl: noop,
    onStartPreview: noop,
    onStopPreview: noop,
    onUrlChange: noop,
    previewStatus: {
      ...runtimePreviewStatus,
      stale: false
    },
    runtimeStatus: "connected",
    session: runtimeSession,
    sessionSynced: true,
    telemetry: runtimeTelemetry,
    url: "http://127.0.0.1:3761",
    viewState: sendReceivePanelSampleViewState
  }
};

export const DisconnectedRuntime: Story = {
  args: {
    ...SendReceivePanel.args,
    controlEnabled: false,
    previewStatus: null,
    runtimeStatus: "disconnected",
    session: null,
    sessionSynced: false,
    telemetry: null
  }
};

export const RunningLiveControl: Story = {
  args: {
    ...SendReceivePanel.args,
    previewStatus: {
      ...runtimePreviewStatus,
      controlLive: true,
      previewControlRevision: 12,
      controlRevision: 12,
      stale: false
    },
    session: {
      ...runtimeSession,
      controlRevision: 12
    },
    telemetry: {
      ...runtimeTelemetry,
      render: {
        ...runtimeTelemetry.render,
        controlLive: true,
        controlRevision: 12,
        previewControlRevision: 12,
        framesRendered: 1280,
        approxFps: 60
      },
      session: {
        ...runtimeTelemetry.session,
        controlRevision: 12
      },
      preview: {
        ...runtimeTelemetry.preview,
        controlLive: true,
        controlRevision: 12,
        previewControlRevision: 12,
        stale: false
      }
    }
  }
};

export const RuntimeRenderError: Story = {
  args: {
    ...SendReceivePanel.args,
    telemetry: runtimeTelemetryWithRenderError
  }
};
