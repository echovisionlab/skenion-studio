import { Alert, Badge, Group, Stack, Text } from "@mantine/core";
import { MonitorPlay, RefreshCw, RotateCw, Square } from "lucide-react";
import {
  canRestartPreview,
  canStartPreview,
  canStopPreview,
  previewBadgeColor,
  previewButtonVariant
} from "../../runtime/previewSync";
import type { RuntimePreviewStatus } from "../../runtime/types";
import { Button } from "../core/Button/Button";

export function RuntimePreviewPanel({
  busyAction,
  connected,
  onRefreshPreview,
  onRestartPreview,
  onStartPreview,
  onStopPreview,
  previewStatus,
  sessionLoaded
}: {
  busyAction: string | null;
  connected: boolean;
  onRefreshPreview: () => void;
  onRestartPreview: () => void;
  onStartPreview: () => void;
  onStopPreview: () => void;
  previewStatus: RuntimePreviewStatus | null;
  sessionLoaded: boolean;
}) {
  const previewState = previewStatus?.state ?? "stopped";
  const previewStale = previewStatus?.stale ?? false;
  const previewActionState = { connected, sessionLoaded, previewStatus };

  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <Text c="dimmed" size="xs">
          Preview
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={previewBadgeColor(previewState, previewStale)} variant="light">
            {previewState}
          </Badge>
          {previewStale ? (
            <Badge color="yellow" variant="light">
              stale
            </Badge>
          ) : null}
          {previewStatus ? (
            <Badge color={previewStatus.controlLive ? "teal" : "yellow"} variant="light">
              {previewStatus.controlLive ? "control live" : "control pending"}
            </Badge>
          ) : null}
        </Group>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!connected} leftSection={<RefreshCw size={15} />} loading={busyAction === "previewStatus"} onClick={onRefreshPreview} size="xs" variant="light">
          Refresh Status
        </Button>
        <Button disabled={!canStartPreview(previewActionState)} leftSection={<MonitorPlay size={15} />} loading={busyAction === "startPreview"} onClick={onStartPreview} size="xs" variant={previewState === "stopped" ? "filled" : "light"}>
          Start Preview
        </Button>
      </Group>

      <Group gap="xs" grow>
        <Button disabled={!canStopPreview(previewStatus)} leftSection={<Square size={15} />} loading={busyAction === "stopPreview"} onClick={onStopPreview} size="xs" variant="light">
          Stop Preview
        </Button>
        <Button disabled={!canRestartPreview(previewActionState)} leftSection={<RotateCw size={15} />} loading={busyAction === "restartPreview"} onClick={onRestartPreview} size="xs" variant={previewButtonVariant(previewStatus)}>
          Restart Preview
        </Button>
      </Group>

      {previewStatus?.issues.length ? (
        <Stack gap={4}>
          {previewStatus.issues.slice(0, 3).map((issue) => (
            <Alert color={issue.severity === "error" ? "red" : "yellow"} key={issue.message} variant="light">
              {issue.message}
            </Alert>
          ))}
        </Stack>
      ) : null}
    </>
  );
}
