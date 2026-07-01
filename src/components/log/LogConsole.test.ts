// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import { theme } from "../../theme";
import {
  LogConsole,
  clientLogLine,
  filterLogLines,
  mergeLogLines,
  runtimeLogLineFromEvent
} from "./LogConsole";

describe("LogConsole", () => {
  it("renders client and runtime messages as timestamped read-only log lines", () => {
    const lines = [
      clientLogLine("client-1", "warning", "Explicit client warning", "2026-06-21T07:00:00.000Z"),
      runtimeLineForTest("runtime-1", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
    ];
    const html = renderToStaticMarkup(
      createElement(MantineProvider, { theme }, createElement(LogConsole, { lines }))
    );

    expect(lines.map((line) => `${line.source}:${line.message}`)).toContain(
      "client:Explicit client warning"
    );
    expect(lines.map((line) => `${line.source}:${line.message}`)).toContain(
      "runtime:Runtime boot"
    );
    expect(html).toContain("role=\"log\"");
    expect(html).toContain("dateTime=\"2026-06-21T07:00:00.000Z\"");
    expect(html).not.toContain("Undo");
    expect(html).not.toContain("Refresh History");
  });

  it("sorts log lines by time and filters runtime-only views", () => {
    const merged = mergeLogLines([
      clientLogLine("late", "error", "Browser error", "2026-06-21T07:00:02.000Z"),
      runtimeLineForTest("early", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
    ]);

    expect(merged.map((line) => line.message)).toEqual(["Runtime boot", "Browser error"]);
    expect(filterLogLines(merged, "runtime").map((line) => line.message)).toEqual(["Runtime boot"]);
  });

  it("converts runtime log stream events and sorts unix-ms timestamps", () => {
    const streamLine = runtimeLogLineFromEvent({
      code: "io-device-enumeration-failed",
      id: 7,
      level: "error",
      message: "device enumeration failed",
      source: "runtime",
      timestamp: "unix-ms:1782015601000"
    });
    const merged = mergeLogLines([
      clientLogLine("later", "info", "Client later", "2026-06-21T07:00:02.000Z"),
      streamLine
    ]);

    expect(streamLine).toMatchObject({
      id: "runtime:stream-7",
      message: "io-device-enumeration-failed: device enumeration failed",
      source: "runtime"
    });
    expect(merged.map((line) => line.message)).toEqual([
      "io-device-enumeration-failed: device enumeration failed",
      "Client later"
    ]);
  });

  it("updates the visible stream when the source filter changes", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    let root: Root | null = createRoot(container);

    await act(async () => {
      root?.render(
        createElement(
          MantineProvider,
          { theme },
          createElement(LogConsole, {
            lines: [
              clientLogLine("client", "error", "Browser error", "2026-06-21T07:00:02.000Z"),
              runtimeLineForTest("runtime", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
            ]
          })
        )
      );
    });

    const runtimeFilter = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Runtime")
    );
    if (!runtimeFilter) {
      throw new Error("runtime filter not found");
    }

    await act(async () => {
      runtimeFilter.click();
    });

    expect(container.textContent).toContain("Runtime boot");
    expect(container.textContent).not.toContain("Browser error");

    await act(async () => {
      root?.unmount();
      root = null;
    });
    container.remove();
  });

  it("does not synthesize state issues into log lines", () => {
    const lines = [
      clientLogLine("client", "error", "Runtime request failed", "2026-06-21T07:00:00.000Z"),
      runtimeLineForTest("runtime", "info", "Runtime boot", "2026-06-21T07:00:01.000Z")
    ];

    expect(lines.some((line) => line.message.includes("missing node"))).toBe(false);
    expect(lines.some((line) => line.message.includes("Invalid graph"))).toBe(false);
  });
});

function runtimeLineForTest(
  id: string,
  level: "info" | "warning" | "error",
  message: string,
  timestamp: string
) {
  return {
    id: `runtime:${id}`,
    level,
    message,
    source: "runtime" as const,
    timestamp
  };
}
