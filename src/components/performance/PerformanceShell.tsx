import { useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  Button,
  Group,
  NumberFormatter,
  ScrollArea,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput
} from "@mantine/core";
import { Cable, MonitorPlay, MousePointerClick, RefreshCw, RotateCw, Square } from "lucide-react";
import type { GraphDocumentV01, ViewStateV01 } from "@skenion/contracts";
import {
  performanceControlPosition,
  performanceControlsFromGraph,
  performanceStatusModel,
  performanceSurfaceBounds,
  runtimeRequestForPerformanceControl
} from "../../graph/performanceSurface";
import {
  canRestartPreview,
  canStartPreview,
  canStopPreview,
  previewBadgeColor
} from "../../runtime/previewSync";
import type {
  RuntimeConnectionStatus,
  RuntimeControlEventRequest,
  RuntimePreviewStatus,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot
} from "../../runtime/types";

export interface PerformanceShellProps {
  busyAction: string | null;
  controlEnabled: boolean;
  error: string | null;
  graph: GraphDocumentV01;
  onConnect: () => void;
  onLoadSession: () => void;
  onRestartPreview: () => void;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onUrlChange: (url: string) => void;
  previewStatus: RuntimePreviewStatus | null;
  runtimeStatus: RuntimeConnectionStatus;
  session: RuntimeSessionResponse | null;
  sessionSynced: boolean;
  telemetry: RuntimeTelemetrySnapshot | null;
  url: string;
  viewState: ViewStateV01;
}

export function PerformanceShell({
  busyAction,
  controlEnabled,
  error,
  graph,
  onConnect,
  onLoadSession,
  onRestartPreview,
  onSendRuntimeControl,
  onStartPreview,
  onStopPreview,
  onUrlChange,
  previewStatus,
  runtimeStatus,
  session,
  sessionSynced,
  telemetry,
  url,
  viewState
}: PerformanceShellProps) {
  const controls = performanceControlsFromGraph(graph, viewState);
  const bounds = performanceSurfaceBounds(controls);
  const status = performanceStatusModel({
    previewStatus,
    runtimeStatus,
    session,
    sessionSynced,
    telemetry
  });
  const connected = runtimeStatus === "connected";
  const sessionLoaded = session?.loaded ?? false;
  const previewActionState = {
    connected,
    previewStatus,
    sessionLoaded
  };
  const previewState = previewStatus?.state ?? "stopped";

  return (
    <div className="performance-shell">
      <section className="performance-stage" aria-label="Performance control surface">
        <Group className="performance-stage-header" justify="space-between" wrap="nowrap">
          <div>
            <Text fw={900} size="lg">
              Performance Mode
            </Text>
            <Text c="dimmed" size="sm">
              {graph.id} · {controls.length} controls
            </Text>
          </div>
          <StatusBadges status={status} />
        </Group>

        {controls.length === 0 ? (
          <Alert color="yellow" radius="sm" variant="light">
            This project has no `ui.*` performance controls.
          </Alert>
        ) : (
          <ScrollArea className="performance-control-scroll" offsetScrollbars>
            <div
              className="performance-control-surface"
              style={{
                height: bounds.height,
                width: bounds.width
              }}
            >
              {controls.map((control) => (
                <div
                  className="performance-control-card"
                  key={control.id}
                  style={performanceControlPosition(control, bounds)}
                >
                  <Text c="dimmed" fw={800} size="xs" tt="uppercase">
                    {control.kind}
                  </Text>
                  <Text fw={800} size="sm">
                    {control.label}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {control.id}
                  </Text>
                  {control.kind === "button" ? (
                    <Button
                      disabled={!controlEnabled}
                      leftSection={<MousePointerClick size={15} />}
                      loading={busyAction === "controlEvent"}
                      onClick={() => onSendRuntimeControl(runtimeRequestForPerformanceControl(control))}
                      radius="sm"
                      size="xs"
                      variant="filled"
                    >
                      Bang
                    </Button>
                  ) : null}
                  {control.kind === "slider-f32" && control.slider ? (
                    <PerformanceSlider
                      busy={busyAction === "controlEvent"}
                      controlEnabled={controlEnabled}
                      control={control}
                      onSendRuntimeControl={onSendRuntimeControl}
                    />
                  ) : null}
                  {control.kind === "toggle" && control.toggle ? (
                    <PerformanceToggle
                      busy={busyAction === "controlEvent"}
                      controlEnabled={controlEnabled}
                      control={control}
                      onSendRuntimeControl={onSendRuntimeControl}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </section>

      <aside className="performance-runtime" aria-label="Performance runtime controls">
        <Stack gap="sm">
          <Text fw={900} size="sm">
            Runtime
          </Text>
          <TextInput
            aria-label="Runtime URL"
            disabled={busyAction !== null}
            onChange={(event) => onUrlChange(event.currentTarget.value)}
            radius="sm"
            size="xs"
            value={url}
          />
          <Group gap="xs" grow>
            <Button
              leftSection={<Cable size={15} />}
              loading={busyAction === "connect"}
              onClick={onConnect}
              radius="sm"
              size="xs"
              variant={connected ? "light" : "filled"}
            >
              Connect
            </Button>
            <Button
              disabled={!connected}
              leftSection={<RefreshCw size={15} />}
              loading={busyAction === "loadSession"}
              onClick={onLoadSession}
              radius="sm"
              size="xs"
              variant="light"
            >
              Load Graph
            </Button>
          </Group>

          <Group gap="xs" grow>
            <Button
              disabled={!canStartPreview(previewActionState)}
              leftSection={<MonitorPlay size={15} />}
              loading={busyAction === "startPreview"}
              onClick={onStartPreview}
              radius="sm"
              size="xs"
              variant={previewState === "stopped" ? "filled" : "light"}
            >
              Start Preview
            </Button>
            <Button
              disabled={!canStopPreview(previewStatus)}
              leftSection={<Square size={15} />}
              loading={busyAction === "stopPreview"}
              onClick={onStopPreview}
              radius="sm"
              size="xs"
              variant="light"
            >
              Stop
            </Button>
          </Group>

          <Button
            disabled={!canRestartPreview(previewActionState)}
            leftSection={<RotateCw size={15} />}
            loading={busyAction === "restartPreview"}
            onClick={onRestartPreview}
            radius="sm"
            size="xs"
            variant="light"
          >
            Restart Preview
          </Button>

          <Stack className="performance-status-grid" gap={6}>
            <StatusRow label="Runtime" value={status.runtimeLabel} />
            <StatusRow label="Session" value={status.sessionLabel} />
            <StatusRow label="Preview" value={`${status.previewLabel}${status.previewStale ? " / stale" : ""}`} />
            <StatusRow label="Control" value={status.controlLabel} />
            <StatusRow label="Control rev" value={status.controlRevision ?? "none"} />
            <StatusRow label="Preview control rev" value={status.previewControlRevision ?? "none"} />
            <StatusRow
              label="Frames"
              value={status.framesRendered === null ? "none" : <NumberFormatter value={status.framesRendered} />}
            />
            <StatusRow
              label="FPS"
              value={status.fps === null ? "none" : <NumberFormatter decimalScale={1} value={status.fps} />}
            />
          </Stack>

          {status.lastError ? (
            <Alert color="red" radius="sm" variant="light">
              {status.lastError}
            </Alert>
          ) : null}
          {error ? (
            <Alert color="red" radius="sm" variant="light">
              {error}
            </Alert>
          ) : null}
        </Stack>
      </aside>
    </div>
  );
}

function PerformanceSlider({
  busy,
  control,
  controlEnabled,
  onSendRuntimeControl
}: {
  busy: boolean;
  control: ReturnType<typeof performanceControlsFromGraph>[number];
  controlEnabled: boolean;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
}) {
  const [value, setValue] = useState(control.slider?.value ?? 0);
  const slider = control.slider ?? { max: 1, min: 0, step: 0.01, value: 0 };
  return (
    <Stack gap={6}>
      <Slider
        disabled={!controlEnabled || busy}
        label={(nextValue) => nextValue.toFixed(2)}
        max={slider.max}
        min={slider.min}
        onChange={setValue}
        onChangeEnd={(nextValue) =>
          onSendRuntimeControl(runtimeRequestForPerformanceControl(control, nextValue))
        }
        step={slider.step}
        value={value}
      />
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          {slider.min}
        </Text>
        <Text fw={800} size="xs">
          {value.toFixed(2)}
        </Text>
        <Text c="dimmed" size="xs">
          {slider.max}
        </Text>
      </Group>
    </Stack>
  );
}

function PerformanceToggle({
  busy,
  control,
  controlEnabled,
  onSendRuntimeControl
}: {
  busy: boolean;
  control: ReturnType<typeof performanceControlsFromGraph>[number];
  controlEnabled: boolean;
  onSendRuntimeControl: (request: RuntimeControlEventRequest) => void;
}) {
  const [checked, setChecked] = useState(control.toggle?.value ?? false);
  return (
    <Switch
      checked={checked}
      disabled={!controlEnabled || busy}
      label={checked ? "On" : "Off"}
      onChange={(event) => {
        setChecked(event.currentTarget.checked);
        onSendRuntimeControl(runtimeRequestForPerformanceControl(control));
      }}
      size="sm"
    />
  );
}

function StatusBadges({ status }: { status: ReturnType<typeof performanceStatusModel> }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Badge color={status.runtimeLabel === "connected" ? "green" : "gray"} radius="sm" variant="light">
        {status.runtimeLabel}
      </Badge>
      <Badge color={status.sessionLabel === "synced" ? "green" : "yellow"} radius="sm" variant="light">
        {status.sessionLabel}
      </Badge>
      <Badge color={previewBadgeColor(status.previewLabel, status.previewStale)} radius="sm" variant="light">
        {status.previewLabel}
      </Badge>
      <Badge color={status.controlLabel === "control live" ? "teal" : "yellow"} radius="sm" variant="light">
        {status.controlLabel}
      </Badge>
    </Group>
  );
}

function StatusRow({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text c="dimmed" size="xs">
        {label}
      </Text>
      <Text fw={800} size="xs">
        {value}
      </Text>
    </Group>
  );
}
