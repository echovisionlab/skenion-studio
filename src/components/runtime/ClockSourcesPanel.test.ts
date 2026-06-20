// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { afterEach, describe, expect, it, vi } from "vitest";
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
import { ClockSourcesPanel } from "./ClockSourcesPanel";
import { ClockStateDisplay } from "./ClockStateDisplay";

type PanelHandlers = Parameters<typeof ClockSourcesPanel>[0];

const actEnvironment = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("ClockSourcesPanel", () => {
  let mountedRoot: Root | null = null;
  let mountedContainer: HTMLDivElement | null = null;

  afterEach(() => {
    if (mountedRoot) {
      act(() => {
        mountedRoot?.unmount();
      });
    }
    mountedContainer?.remove();
    mountedRoot = null;
    mountedContainer = null;
  });

  it("renders no-device state without treating it as an error", () => {
    const html = renderPanel({
      ...handlers(),
      connected: true,
      initialInputs: [],
      initialSources: []
    });

    expect(html).toContain("No MIDI input ports found.");
    expect(html).toContain("not stable identity");
    expect(html).toContain("Clock diagnostics clear.");
  });

  it("renders invalid diagnostics and source rows", () => {
    const html = renderPanel({
      ...handlers(),
      connected: true,
      initialDiagnostics: [
        {
          code: "invalid-midi-input-port",
          message: "MIDI input port index is not available.",
          severity: "error"
        }
      ],
      initialSources: [clockSource()]
    });

    expect(html).toContain("invalid-midi-input-port");
    expect(html).toContain("midi-clock-main");
    expect(html).toContain("running");
  });

  it("renders clock authority badges", () => {
    const html = renderToStaticMarkup(
      createElement(MantineProvider, null, createElement(ClockStateDisplay, { state: clockState() }))
    );

    expect(html).toContain("authoritative");
    expect(html).toContain("derived");
    expect(html).toContain("unavailable");
    expect(html).toContain("SONG POS");
  });

  it("calls start and stop runtime APIs only after explicit buttons", async () => {
    const onStartMidiClockSource = vi.fn(async (request: MidiClockSourceStartRequest) =>
      midiStartResponse(clockSource({ sourceId: request.sourceId }))
    );
    const onStopMidiClockSource = vi.fn(async (request: MidiClockSourceStopRequest) =>
      midiStopResponse(clockSource({ sourceId: request.sourceId, status: "stopped" }))
    );
    const mounted = await mountPanel({
      ...handlers(),
      connected: true,
      initialInputs: [],
      initialSources: [],
      onStartMidiClockSource,
      onStopMidiClockSource
    });

    expect(onStartMidiClockSource).not.toHaveBeenCalled();
    expect(onStopMidiClockSource).not.toHaveBeenCalled();

    await clickButton(mounted.container, "Start MIDI");
    expect(onStartMidiClockSource).toHaveBeenCalledWith({
      inputPortIndex: 0,
      sourceId: "midi-clock",
      timeSignature: { numerator: 4, denominator: 4 }
    });

    await clickButton(mounted.container, "Stop MIDI");
    expect(onStopMidiClockSource).toHaveBeenCalledWith({ sourceId: "midi-clock" });
  });

  it("does not auto-start a MIDI source when the panel is mounted", async () => {
    const onStartMidiClockSource = vi.fn(async () => midiStartResponse(clockSource()));
    await mountPanel({
      ...handlers(),
      connected: true,
      initialSources: [clockSource()],
      onStartMidiClockSource
    });

    expect(onStartMidiClockSource).not.toHaveBeenCalled();
  });

  async function mountPanel(props: PanelHandlers) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(createElement(MantineProvider, null, createElement(ClockSourcesPanel, props)));
    });

    return { container, root };
  }
});

function renderPanel(props: PanelHandlers): string {
  return renderToStaticMarkup(
    createElement(MantineProvider, null, createElement(ClockSourcesPanel, props))
  );
}

async function clickButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) =>
    candidate.textContent?.includes(label)
  );
  if (!button) {
    throw new Error(`button not found: ${label}`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

function handlers(): Omit<
  PanelHandlers,
  "connected" | "initialDiagnostics" | "initialInputs" | "initialSources"
> {
  return {
    onGetClockSource: async (sourceId: string): Promise<ClockSourceSnapshotResponse> => ({
      diagnostics: [],
      ok: true,
      source: clockSource({ sourceId })
    }),
    onListClockSources: async (): Promise<ClockSourceListResponse> => ({
      diagnostics: [],
      ok: true,
      sources: [clockSource()]
    }),
    onListMidiInputs: async (): Promise<MidiInputListResponse> => ({
      diagnostics: [],
      inputs: [],
      ok: true
    }),
    onStartMidiClockSource: async (): Promise<MidiClockSourceStartResponse> =>
      midiStartResponse(clockSource()),
    onStopMidiClockSource: async (): Promise<MidiClockSourceStopResponse> =>
      midiStopResponse(clockSource({ status: "stopped" }))
  };
}

function midiStartResponse(source: ClockSourceSnapshot): MidiClockSourceStartResponse {
  return {
    diagnostics: [],
    ok: true,
    source
  };
}

function midiStopResponse(source: ClockSourceSnapshot): MidiClockSourceStopResponse {
  return {
    diagnostics: [],
    ok: true,
    source
  };
}

function clockSource(overrides: Partial<ClockSourceSnapshot> = {}): ClockSourceSnapshot {
  return {
    diagnostics: [],
    latestSnapshot: clockState(overrides.sourceId),
    sourceId: "midi-clock-main",
    sourceKind: "midi-clock",
    status: "running",
    ...overrides
  };
}

function clockState(sourceId = "midi-clock-main"): ClockStateV01 {
  return {
    bar: { authority: "derived", source: sourceId, value: 8 },
    beat: { authority: "derived", source: sourceId, value: 3 },
    capabilities: ["running", "tick", "ppq-position", "song-position", "bar-beat", "time-signature"],
    division: { authority: "derived", source: sourceId, value: 1 },
    lastUpdateHostTimeNs: 987654321,
    phase01: { authority: "derived", source: sourceId, value: 0.5 },
    ppqPosition: { authority: "derived", source: sourceId, value: 30.5 },
    running: { authority: "authoritative", source: sourceId, value: true },
    sampleFrame: { authority: "unavailable", source: sourceId, value: null },
    sampleRate: { authority: "unavailable", source: sourceId, value: null },
    songPositionSixteenth: { authority: "authoritative", source: sourceId, value: 122 },
    sourceId,
    sourceKind: "midi-clock",
    tempoBpm: { authority: "unavailable", source: sourceId, value: null },
    tickIndex: { authority: "authoritative", source: sourceId, value: 732 },
    timeSeconds: { authority: "unavailable", source: sourceId, value: null },
    timeSignature: { authority: "authoritative", source: sourceId, value: { numerator: 4, denominator: 4 } },
    timecode: { authority: "unavailable", source: sourceId, value: null }
  };
}
