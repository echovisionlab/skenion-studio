import { useMemo, useState } from "react";
import { Group, Text } from "@mantine/core";
import type { RuntimeLogEvent } from "../../runtime/types";
import { Button } from "../core/Button/Button";
import styles from "./LogConsole.module.css";

export type LogSource = "client" | "runtime";
export type LogLevel = "info" | "warning" | "error";
export type LogSourceFilter = "all" | LogSource;

export interface LogLine {
  id: string;
  level: LogLevel;
  message: string;
  source: LogSource;
  timestamp: string;
}

export function mergeLogLines(lines: LogLine[]): LogLine[] {
  return [...lines].sort((left, right) => {
    const timeDiff = logTimestampMillis(left.timestamp) - logTimestampMillis(right.timestamp);
    return timeDiff === 0 ? left.id.localeCompare(right.id) : timeDiff;
  });
}

export function filterLogLines(lines: LogLine[], filter: LogSourceFilter): LogLine[] {
  return filter === "all" ? lines : lines.filter((line) => line.source === filter);
}

export function LogConsole({ lines }: { lines: LogLine[] }) {
  const [filter, setFilter] = useState<LogSourceFilter>("all");
  const sortedLines = useMemo(() => mergeLogLines(lines), [lines]);
  const filteredLines = useMemo(() => filterLogLines(sortedLines, filter), [filter, sortedLines]);

  return (
    <>
      <Group className={styles.toolbar} justify="space-between" wrap="nowrap">
        <Text c="dimmed" fw={700} size="xs" tt="uppercase">
          Logs
        </Text>
        <Group gap={4} role="radiogroup" aria-label="Log source filter">
          {([
            ["all", "All"],
            ["client", "Client"],
            ["runtime", "Runtime"]
          ] as const).map(([value, label]) => (
            <Button
              aria-checked={filter === value}
              key={value}
              onClick={() => setFilter(value)}
              role="radio"
              selected={filter === value}
              size="xs"
              variant={filter === value ? "light" : "subtle"}
            >
              {label}
            </Button>
          ))}
        </Group>
      </Group>
      <div aria-label="Logs" className={styles.console} role="log">
        {filteredLines.map((line) => (
          <div className={[styles.line, styles[line.level]].join(" ")} key={line.id}>
            <time className={styles.timestamp} dateTime={line.timestamp}>
              {formatLogTime(line.timestamp)}
            </time>
            <span className={styles.source}>{line.source}</span>
            <span className={styles.level}>{line.level}</span>
            <span className={styles.message}>{line.message}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function clientLogLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return clientLine(id, level, message, timestamp);
}

export function runtimeLogLineFromEvent(event: RuntimeLogEvent): LogLine {
  return runtimeLine(
    `stream-${event.id}`,
    event.level,
    event.code ? `${event.code}: ${event.message}` : event.message,
    event.timestamp
  );
}

function clientLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return {
    id: `client:${id}`,
    level,
    message,
    source: "client",
    timestamp
  };
}

function runtimeLine(id: string, level: LogLevel, message: string, timestamp: string): LogLine {
  return {
    id: `runtime:${id}`,
    level,
    message,
    source: "runtime",
    timestamp
  };
}

function formatLogTime(timestamp: string): string {
  const millis = logTimestampMillis(timestamp);
  if (Number.isNaN(millis)) {
    return "--:--:--";
  }
  const date = new Date(millis);
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function logTimestampMillis(timestamp: string): number {
  if (timestamp.startsWith("unix-ms:")) {
    return Number(timestamp.slice("unix-ms:".length));
  }
  return Date.parse(timestamp);
}
