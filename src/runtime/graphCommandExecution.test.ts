import { describe, expect, it, vi } from "vitest";
import {
  runtimeGraphCommandRejectionMessage,
  sendRuntimeGraphCommandAndRefresh
} from "./graphCommandExecution";
import type { RuntimeClient } from "./client";
import type {
  RuntimeGraphCommandClient,
  RuntimeGraphCommandResponse
} from "./graphCommand";
import type { RuntimeSessionResponse } from "./types";

const emptySession = {
  ok: true,
  issues: [],
  report: null,
  snapshot: {
    bindingFormats: [],
    controlRevision: 1,
    issues: [],
    plan: null,
    project: null,
    sessionRevision: 1,
    viewRevision: 1
  }
} as RuntimeSessionResponse;

function graphCommandResponse(overrides: Partial<RuntimeGraphCommandResponse> = {}): RuntimeGraphCommandResponse {
  return {
    ack: {
      schema: "skenion.runtime.realtime",
      schemaVersion: "0.1.0",
      messageId: "ack_1",
      payload: {},
      sessionId: "default",
      type: "graph.ack"
    },
    applied: true,
    conflict: false,
    issues: [],
    ok: true,
    payload: {
      accepted: true,
      applied: true,
      conflict: false,
      issues: [],
      kind: "graph.changeSet",
      status: "accepted"
    },
    ...overrides
  };
}

describe("runtime graph command execution", () => {
  it("refreshes the Runtime session after the command resolves", async () => {
    const response = graphCommandResponse();
    const graphCommandClient = {
      sendGraphCommand: vi.fn(async () => response)
    } satisfies RuntimeGraphCommandClient;
    const runtimeClient = {} as RuntimeClient;
    const refreshRuntimeProject = vi.fn(async () => emptySession);

    await expect(
      sendRuntimeGraphCommandAndRefresh({
        graphCommandClient,
        payload: { kind: "graph.changeSet", changes: [] },
        refreshRuntimeProject,
        runtimeClient
      })
    ).resolves.toEqual({ response, session: emptySession });
    expect(graphCommandClient.sendGraphCommand).toHaveBeenCalledWith({ kind: "graph.changeSet", changes: [] });
    expect(refreshRuntimeProject).toHaveBeenCalledWith(runtimeClient);
    expect(graphCommandClient.sendGraphCommand.mock.invocationCallOrder[0]).toBeLessThan(
      refreshRuntimeProject.mock.invocationCallOrder[0]
    );
  });

  it("returns null for applied commands and a stable message for rejected commands", () => {
    expect(runtimeGraphCommandRejectionMessage(graphCommandResponse(), "fallback")).toBeNull();
    expect(
      runtimeGraphCommandRejectionMessage(
        graphCommandResponse({
          applied: false,
          issues: [{ severity: "error", code: "runtime.graph.rejected", message: "Rejected by Runtime." }],
          ok: false
        }),
        "fallback"
      )
    ).toBe("Rejected by Runtime.");
    expect(
      runtimeGraphCommandRejectionMessage(
        graphCommandResponse({
          applied: false,
          issues: [],
          ok: false
        }),
        "fallback"
      )
    ).toBe("fallback");
  });
});
