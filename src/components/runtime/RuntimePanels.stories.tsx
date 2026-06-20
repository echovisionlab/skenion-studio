import type { Meta, StoryObj } from "@storybook/react-vite";
import { Divider, Stack } from "@mantine/core";
import type {
  ClockSourceListResponse,
  ClockSourceSnapshot,
  ClockSourceSnapshotResponse,
  ClockStateV01,
  MidiClockSourceStartRequest,
  MidiClockSourceStartResponse,
  MidiClockSourceStopRequest,
  MidiClockSourceStopResponse,
  MidiInputListResponse
} from "../../runtime/types";
import { RuntimePanel } from "../RuntimePanel";
import { ClockSourcesPanel } from "./ClockSourcesPanel";
import { ClockStateDisplay } from "./ClockStateDisplay";
import { RuntimeConnectionPanel } from "./RuntimeConnectionPanel";
import { RuntimeHistoryPanel } from "./RuntimeHistoryPanel";
import { RuntimePreviewPanel } from "./RuntimePreviewPanel";
import { RuntimeSessionPanel } from "./RuntimeSessionPanel";
import { RuntimeTelemetryPanel } from "./RuntimeTelemetryPanel";
import {
  latestHistoryEvents,
  runtimeHistoryActionAvailability
} from "../../runtime/historySync";
import {
  noop,
  runtimeHistory,
  runtimeInfo,
  runtimePreviewStatus,
  runtimeSession,
  runtimeTelemetry,
  runtimeTelemetryWithRenderError
} from "../../stories/storyFixtures";

const meta = {
  title: "Runtime/Panels",
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
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  render: () => (
    <RuntimeConnectionPanel
      busyAction={null}
      connected={false}
      onConnect={noop}
      onRefreshSession={noop}
      onUrlChange={noop}
      status="disconnected"
      url="http://localhost:3761"
    />
  )
};

export const ConnectionAndSession: Story = {
  render: () => (
    <Stack gap="sm">
      <RuntimeConnectionPanel
        busyAction={null}
        connected
        onConnect={noop}
        onRefreshSession={noop}
        onUrlChange={noop}
        status="connected"
        url="http://localhost:3761"
      />
      <Divider />
      <RuntimeSessionPanel
        busyAction={null}
        connected
        onClearSession={noop}
        onPlanSession={noop}
        onRunSession={noop}
        onValidateSession={noop}
        session={runtimeSession}
        sessionLoaded
        sessionSynced={false}
      />
    </Stack>
  )
};

export const PreviewTelemetry: Story = {
  render: () => (
    <Stack gap="sm">
      <RuntimePreviewPanel
        busyAction={null}
        connected
        onRefreshPreview={noop}
        onRestartPreview={noop}
        onStartPreview={noop}
        onStopPreview={noop}
        previewStatus={runtimePreviewStatus}
        sessionLoaded
      />
      <RuntimeTelemetryPanel telemetry={runtimeTelemetry} />
    </Stack>
  )
};

export const TelemetryRenderError: Story = {
  render: () => <RuntimeTelemetryPanel telemetry={runtimeTelemetryWithRenderError} />
};

export const HistoryControls: Story = {
  render: () => (
    <RuntimeHistoryPanel
      busyAction={null}
      connected
      history={runtimeHistory}
      historyAvailability={runtimeHistoryActionAvailability({
        connected: true,
        sessionLoaded: true,
        sessionSynced: true,
        pendingPatchOps: 0,
        history: runtimeHistory
      })}
      latestEvents={latestHistoryEvents(runtimeHistory, 3)}
      onRedoPatch={noop}
      onRefreshHistory={noop}
      onUndoPatch={noop}
      sessionLoaded
    />
  )
};

export const FullRuntimePanel: Story = {
  render: () => (
    <RuntimePanel
      busyAction={null}
      error={null}
      history={runtimeHistory}
      info={runtimeInfo}
      onGetClockSource={clockApiHandlers.onGetClockSource}
      onListClockSources={clockApiHandlers.onListClockSources}
      onListMidiInputs={clockApiHandlers.onListMidiInputs}
      onClearSession={noop}
      onConnect={noop}
      onPlanSession={noop}
      onRedoPatch={noop}
      onRefreshHistory={noop}
      onRefreshPreview={noop}
      onRefreshSession={noop}
      onRestartPreview={noop}
      onRunSession={noop}
      onStartMidiClockSource={clockApiHandlers.onStartMidiClockSource}
      onStartPreview={noop}
      onStopMidiClockSource={clockApiHandlers.onStopMidiClockSource}
      onStopPreview={noop}
      onUndoPatch={noop}
      onUrlChange={noop}
      onValidateSession={noop}
      previewStatus={runtimePreviewStatus}
      result={null}
      session={runtimeSession}
      sessionSynced={false}
      status="connected"
      telemetry={runtimeTelemetry}
      url="http://localhost:3761"
    />
  )
};

export const ClockSourcesNoDevices: Story = {
  render: () => (
    <ClockSourcesPanel
      connected
      initialInputs={[]}
      initialSources={[]}
      {...clockApiHandlers}
    />
  )
};

export const ClockSourcesRunning: Story = {
  render: () => (
    <ClockSourcesPanel
      connected
      initialInputs={[
        {
          backend: "midir",
          id: null,
          index: 0,
          name: "USB MIDI Interface",
          stable: false
        }
      ]}
      initialSources={[runningMidiSource()]}
      {...clockApiHandlers}
    />
  )
};

export const ClockSourcesInvalidPortDiagnostic: Story = {
  render: () => (
    <ClockSourcesPanel
      connected
      initialDiagnostics={[
        {
          code: "invalid-midi-input-port",
          message: "MIDI input port index is not available.",
          severity: "error"
        }
      ]}
      initialInputs={[]}
      initialSources={[]}
      {...clockApiHandlers}
    />
  )
};

export const ClockStateMixedAuthority: Story = {
  render: () => <ClockStateDisplay state={clockState()} />
};

export const ClockStateBarUnavailable: Story = {
  render: () => (
    <ClockStateDisplay
      state={{
        ...clockState(),
        bar: { authority: "unavailable", source: "midi-clock-main", value: null },
        beat: { authority: "unavailable", source: "midi-clock-main", value: null },
        division: { authority: "unavailable", source: "midi-clock-main", value: null },
        timeSignature: { authority: "unavailable", source: "midi-clock-main", value: null }
      }}
    />
  )
};

const clockApiHandlers = {
  onGetClockSource: async (sourceId: string): Promise<ClockSourceSnapshotResponse> => ({
    diagnostics: [],
    ok: true,
    source: runningMidiSource(sourceId)
  }),
  onListClockSources: async (): Promise<ClockSourceListResponse> => ({
    diagnostics: [],
    ok: true,
    sources: [runningMidiSource()]
  }),
  onListMidiInputs: async (): Promise<MidiInputListResponse> => ({
    diagnostics: [],
    inputs: [],
    ok: true
  }),
  onStartMidiClockSource: async (
    request: MidiClockSourceStartRequest
  ): Promise<MidiClockSourceStartResponse> => ({
    diagnostics: [],
    ok: true,
    source: runningMidiSource(request.sourceId)
  }),
  onStopMidiClockSource: async (
    request: MidiClockSourceStopRequest
  ): Promise<MidiClockSourceStopResponse> => ({
    diagnostics: [],
    ok: true,
    source: {
      ...runningMidiSource(request.sourceId),
      status: "stopped"
    }
  })
};

function runningMidiSource(sourceId = "midi-clock-main"): ClockSourceSnapshot {
  return {
    diagnostics: [],
    latestSnapshot: clockState(sourceId),
    sourceId,
    sourceKind: "midi-clock",
    status: "running"
  };
}

function clockState(sourceId = "midi-clock-main"): ClockStateV01 {
  return {
    bar: { authority: "derived", source: sourceId, value: 37 },
    beat: { authority: "derived", source: sourceId, value: 2 },
    capabilities: ["running", "tick", "ppq-position", "song-position", "bar-beat", "time-signature"],
    division: { authority: "derived", source: sourceId, value: 3 },
    lastUpdateHostTimeNs: 123456789,
    phase01: { authority: "derived", source: sourceId, value: 0.5 },
    ppqPosition: { authority: "derived", source: sourceId, value: 145.5 },
    running: { authority: "authoritative", source: sourceId, value: true },
    sampleFrame: { authority: "unavailable", source: sourceId, value: null },
    sampleRate: { authority: "unavailable", source: sourceId, value: null },
    songPositionSixteenth: { authority: "authoritative", source: sourceId, value: 581 },
    sourceId,
    sourceKind: "midi-clock",
    tempoBpm: { authority: "unavailable", source: sourceId, value: null },
    tickIndex: { authority: "authoritative", source: sourceId, value: 3486 },
    timeSeconds: { authority: "unavailable", source: sourceId, value: null },
    timeSignature: { authority: "authoritative", source: sourceId, value: { numerator: 4, denominator: 4 } },
    timecode: { authority: "unavailable", source: sourceId, value: null }
  };
}
