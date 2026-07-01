import { Alert, Divider, Stack, Text } from "@mantine/core";
import { Activity } from "lucide-react";
import type {
  ManagedSidecarStatus,
  RuntimeProfileId,
  RuntimeProfileState
} from "../desktop/runtimeProfiles";
import type { StudioWindowMode } from "../desktop/windowRegistry";
import type {
  RuntimeConnectionStatus,
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionResponse
} from "../runtime/types";
import { RuntimeConnectionPanel } from "./runtime/RuntimeConnectionPanel";
import { LogConsole, mergeLogLines, type LogLine } from "./log/LogConsole";
import { RuntimePreviewPanel } from "./runtime/RuntimePreviewPanel";

interface RuntimeSettingsPanelProps {
  busyAction: string | null;
  desktopAvailable: boolean;
  error: string | null;
  info: RuntimeInfo | null;
  profileState: RuntimeProfileState;
  previewStatus: RuntimePreviewStatus | null;
  session: RuntimeSessionResponse | null;
  sessionId: string;
  sidecarStatus: ManagedSidecarStatus;
  status: RuntimeConnectionStatus;
  url: string;
  windowCount: number;
  windowMode: StudioWindowMode;
  onConnect: () => void;
  onOpenNewRuntimeWindow: () => void;
  onOpenNewWindow: () => void;
  onProfileChange: (profileId: RuntimeProfileId) => void;
  onRefreshPreview: () => void;
  onRestartPreview: () => void;
  onRefreshSession: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  onUrlChange: (url: string) => void;
}

interface RuntimeLogsPanelProps {
  clientLines: LogLine[];
  runtimeLines: LogLine[];
}

export function RuntimeSettingsPanel({
  busyAction,
  desktopAvailable,
  error,
  info,
  profileState,
  previewStatus,
  session,
  sessionId,
  sidecarStatus,
  status,
  url,
  windowCount,
  windowMode,
  onConnect,
  onOpenNewRuntimeWindow,
  onOpenNewWindow,
  onProfileChange,
  onRefreshPreview,
  onRestartPreview,
  onRefreshSession,
  onStartPreview,
  onStopPreview,
  onUrlChange
}: RuntimeSettingsPanelProps) {
  const connected = status === "connected";
  const sessionLoaded = Boolean(session?.snapshot.project);

  return (
    <Stack className="runtime-panel" gap="sm">
      <RuntimeConnectionPanel
        busyAction={busyAction}
        connected={connected}
        desktopAvailable={desktopAvailable}
        onConnect={onConnect}
        onOpenNewRuntimeWindow={onOpenNewRuntimeWindow}
        onOpenNewWindow={onOpenNewWindow}
        onProfileChange={onProfileChange}
        onRefreshSession={onRefreshSession}
        onUrlChange={onUrlChange}
        profileState={profileState}
        sessionId={sessionId}
        sidecarStatus={sidecarStatus}
        status={status}
        url={url}
        windowCount={windowCount}
        windowMode={windowMode}
      />

      <Divider />

      <RuntimePreviewPanel
        busyAction={busyAction}
        connected={connected}
        onRefreshPreview={onRefreshPreview}
        onRestartPreview={onRestartPreview}
        onStartPreview={onStartPreview}
        onStopPreview={onStopPreview}
        previewStatus={previewStatus}
        sessionLoaded={sessionLoaded}
      />

      {info ? (
        <Alert color="blue" icon={<Activity size={16} />} variant="light">
          <Text fw={700} size="sm">
            {info.name} {info.version}
          </Text>
          <Text c="dimmed" size="xs">
            API {info.apiVersion}
          </Text>
        </Alert>
      ) : null}

      {error ? (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      ) : null}
    </Stack>
  );
}

export function RuntimeLogsPanel({
  clientLines,
  runtimeLines
}: RuntimeLogsPanelProps) {
  const lines = mergeLogLines([...clientLines, ...runtimeLines]);

  return (
    <Stack className="runtime-panel" gap="sm">
      <LogConsole lines={lines} />
    </Stack>
  );
}
