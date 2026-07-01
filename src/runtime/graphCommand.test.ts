import { describe, expect, it, vi } from "vitest";
import {
  createRuntimeGraphCommandClient,
  RuntimeGraphCommandError,
  runtimeRealtimeWebSocketUrl,
  type RuntimeRealtimeEnvelope,
  type RuntimeWebSocket
} from "./graphCommand";

class FakeWebSocket implements RuntimeWebSocket {
  static instances: FakeWebSocket[] = [];

  readonly sent: RuntimeRealtimeEnvelope[] = [];
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
    setTimeout(() => this.onopen?.({}), 0);
  }

  close() {
    this.onclose?.({});
  }

  send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.emit("session.attached", `${frame.messageId}-attached`, frame.sessionId, {
        currentRevisions: {
          sessionRevision: 1,
          graphRevision: "rev_1",
          viewRevision: 1,
          controlRevision: 1
        }
      }, frame);
    }
    if (frame.type === "graph.command") {
      this.emit("graph.ack", `${frame.messageId}-ack`, frame.sessionId, {
        accepted: true,
        applied: true,
        cached: false,
        conflict: false,
        issues: [],
        eventCursor: "cursor_1",
        graphRevision: "rev_2",
        kind: frame.payload && typeof frame.payload === "object" && "kind" in frame.payload
          ? (frame.payload as { kind: string }).kind
          : "graph.command",
        node: {
          nodeId: "osc_440",
          objectSpec: "osc~ 440"
        },
        sessionRevision: 2,
        status: "accepted",
        viewRevision: 1
      }, frame);
    }
  }

  protected emit(
    type: string,
    messageId: string,
    sessionId: string,
    payload: unknown,
    source: RuntimeRealtimeEnvelope
  ) {
    this.onmessage?.({
      data: JSON.stringify({
        schema: "skenion.runtime.realtime",
        schemaVersion: "0.1.0",
        type,
        messageId,
        sessionId,
        commandId: source.commandId,
        correlationId: source.correlationId ?? source.messageId,
        payload
      } satisfies RuntimeRealtimeEnvelope)
    });
  }
}

class ClosingAfterHelloWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onclose?.({});
    }
  }
}

class ErrorBeforeOpenWebSocket implements RuntimeWebSocket {
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    setTimeout(() => this.onerror?.({}), 0);
  }

  close() {}
  send() {}
}

class CloseBeforeOpenWebSocket implements RuntimeWebSocket {
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    setTimeout(() => this.onclose?.({}), 0);
  }

  close() {}
  send() {}
}

class InvalidFrameAfterHelloWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onmessage?.({ data: "{" });
    }
  }
}

class UnsupportedFrameAfterHelloWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onmessage?.({
        data: JSON.stringify({
          schema: "wrong",
          schemaVersion: "0.1.0",
          type: "session.attached",
          messageId: `${frame.messageId}-unsupported`,
          sessionId: frame.sessionId,
          payload: {}
        })
      });
    }
  }
}

class IncompleteFrameAfterHelloWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onmessage?.({
        data: JSON.stringify({
          schema: "skenion.runtime.realtime",
          schemaVersion: "0.1.0",
          type: "session.attached",
          messageId: `${frame.messageId}-incomplete`,
          payload: {}
        })
      });
    }
  }
}

class NonErrorParseFailureAfterHelloWebSocket implements RuntimeWebSocket {
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onopen: ((event: unknown) => void) | null = null;

  constructor(readonly url: string) {
    setTimeout(() => this.onopen?.({}), 0);
  }

  close() {}

  send() {
    this.onmessage?.({ data: "non-error-parse-failure" });
  }
}

class RuntimeErrorAfterHelloWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.emitRuntimeError(frame, { issue: { message: "Runtime refused session." } });
    }
  }

  private emitRuntimeError(source: RuntimeRealtimeEnvelope, payload: unknown) {
    this.onmessage?.({
      data: JSON.stringify({
        schema: "skenion.runtime.realtime",
        schemaVersion: "0.1.0",
        type: "runtime.error",
        messageId: `${source.messageId}-error`,
        sessionId: source.sessionId,
        payload
      } satisfies RuntimeRealtimeEnvelope)
    });
  }
}

class RuntimeErrorWithoutIssueWebSocket extends RuntimeErrorAfterHelloWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onmessage?.({
        data: JSON.stringify({
          schema: "skenion.runtime.realtime",
          schemaVersion: "0.1.0",
          type: "runtime.error",
          messageId: `${frame.messageId}-error`,
          sessionId: frame.sessionId,
          payload: {}
        } satisfies RuntimeRealtimeEnvelope)
      });
    }
  }
}

class InvalidAckPayloadWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.emit("session.attached", `${frame.messageId}-attached`, frame.sessionId, {}, frame);
    }
    if (frame.type === "graph.command") {
      this.emit("graph.ack", `${frame.messageId}-ack`, frame.sessionId, null, frame);
    }
  }
}

class FallbackAckPayloadWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.emit("session.attached", `${frame.messageId}-attached`, frame.sessionId, {}, frame);
    }
    if (frame.type === "graph.command") {
      this.emit("graph.ack", `${frame.messageId}-ack`, frame.sessionId, {
        issues: [
          { severity: "debug", code: "ignored" },
          { severity: "warning", code: "runtime.graph.warning", message: "Warned." }
        ],
        historySummary: {
          canUndo: true,
          canRedo: false,
          undoDepth: 2,
          redoDepth: 0
        },
        target: { path: { kind: "root" }, baseRevision: "rev_1" }
      }, frame);
    }
  }
}

class DelayedAckWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      setTimeout(() => {
        this.emit("session.attached", `${frame.messageId}-attached`, frame.sessionId, {}, frame);
      }, 0);
    }
    if (frame.type === "graph.command") {
      setTimeout(() => {
        this.emit("graph.ack", `${frame.messageId}-ack`, frame.sessionId, {
          accepted: true,
          applied: true,
          conflict: false,
          status: "accepted"
        }, frame);
      }, 0);
    }
  }
}

class ObjectFrameSparseHistoryWebSocket extends FakeWebSocket {
  override send(data: string) {
    const frame = JSON.parse(data) as RuntimeRealtimeEnvelope;
    this.sent.push(frame);
    if (frame.type === "session.hello") {
      this.onmessage?.({
        data: {
          schema: "skenion.runtime.realtime",
          schemaVersion: "0.1.0",
          type: "session.attached",
          messageId: `${frame.messageId}-attached`,
          sessionId: frame.sessionId,
          commandId: frame.commandId,
          correlationId: frame.correlationId ?? frame.messageId,
          payload: {}
        } satisfies RuntimeRealtimeEnvelope
      });
    }
    if (frame.type === "graph.command") {
      this.onmessage?.({
        data: {
          schema: "skenion.runtime.realtime",
          schemaVersion: "0.1.0",
          type: "graph.ack",
          messageId: `${frame.messageId}-ack`,
          sessionId: frame.sessionId,
          commandId: frame.commandId,
          correlationId: frame.correlationId ?? frame.messageId,
          payload: {
            accepted: true,
            applied: true,
            conflict: false,
            status: "accepted",
            historySummary: {
              canUndo: true,
              canRedo: true
            }
          }
        } satisfies RuntimeRealtimeEnvelope
      });
    }
  }
}

class NoAttachWebSocket extends FakeWebSocket {
  override send(data: string) {
    this.sent.push(JSON.parse(data) as RuntimeRealtimeEnvelope);
  }
}

describe("runtime graph command client", () => {
  it("requires a websocket implementation", () => {
    vi.stubGlobal("WebSocket", undefined);
    expect(() => createRuntimeGraphCommandClient()).toThrow("Runtime realtime WebSocket is unavailable.");
    vi.unstubAllGlobals();
  });

  it("builds a websocket URL from the Runtime HTTP base URL", () => {
    expect(runtimeRealtimeWebSocketUrl("http://127.0.0.1:3761", "skn-doc")).toBe(
      "ws://127.0.0.1:3761/v0/sessions/skn-doc"
    );
    expect(runtimeRealtimeWebSocketUrl("https://runtime.example", "shared")).toBe(
      "wss://runtime.example/v0/sessions/shared"
    );
    expect(runtimeRealtimeWebSocketUrl("ws://runtime.example/", " ")).toBe(
      "ws://runtime.example/v0/sessions/default"
    );
    expect(() => runtimeRealtimeWebSocketUrl("ftp://runtime.example", "shared")).toThrow(RuntimeGraphCommandError);
  });

  it("sends session hello and graph.command frames, then parses graph ACK payloads", async () => {
    FakeWebSocket.instances = [];
    const client = createRuntimeGraphCommandClient({
      baseUrl: "http://127.0.0.1:3761",
      sessionId: "skn-doc",
      WebSocketImpl: FakeWebSocket
    });

    const response = await client.sendGraphCommand({
      kind: "node.create",
      objectSpec: "osc~ 440",
      target: {
        path: { kind: "root" },
        baseRevision: "rev_1"
      }
    }, {
      commandId: "create-osc"
    });

    const socket = FakeWebSocket.instances[0];
    expect(socket.url).toBe("ws://127.0.0.1:3761/v0/sessions/skn-doc");
    expect(socket.sent.map((frame) => frame.type)).toEqual(["session.hello", "graph.command"]);
    expect(socket.sent[1]).toMatchObject({
      commandId: "create-osc",
      idempotencyKey: "create-osc",
      payload: {
        kind: "node.create",
        objectSpec: "osc~ 440"
      },
      type: "graph.command"
    });
    expect(response).toMatchObject({
      applied: true,
      ok: true,
      payload: {
        kind: "node.create",
        node: {
          nodeId: "osc_440",
          objectSpec: "osc~ 440"
        }
      }
    });
  });

  it("waits for asynchronous attach and ACK frames", async () => {
    const response = await createRuntimeGraphCommandClient({
      WebSocketImpl: DelayedAckWebSocket
    }).sendGraphCommand({
      kind: "history.redo",
      scope: "client"
    });

    expect(response).toMatchObject({
      ok: true,
      payload: {
        applied: true,
        kind: "graph.command",
        status: "accepted"
      }
    });
  });

  it("accepts object realtime frames and sparse history summaries", async () => {
    const response = await createRuntimeGraphCommandClient({
      WebSocketImpl: ObjectFrameSparseHistoryWebSocket
    }).sendGraphCommand({
      kind: "history.undo",
      scope: "client"
    });

    expect(response.payload.historySummary).toEqual({
      latestEntryId: null,
      canUndo: true,
      canRedo: true,
      undoDepth: 0,
      redoDepth: 0
    });
  });

  it("fails immediately when the socket closes after opening", async () => {
    FakeWebSocket.instances = [];
    const client = createRuntimeGraphCommandClient({
      baseUrl: "http://127.0.0.1:3761",
      sessionId: "skn-doc",
      WebSocketImpl: ClosingAfterHelloWebSocket
    });

    await expect(client.sendGraphCommand({
      kind: "node.create",
      objectSpec: "osc~ 440"
    }, { timeoutMs: 1000 })).rejects.toThrow("Runtime realtime WebSocket closed before graph command completed.");
  });

  it("reports websocket open failures before sending a graph command", async () => {
    const errorClient = createRuntimeGraphCommandClient({
      WebSocketImpl: ErrorBeforeOpenWebSocket
    });
    await expect(errorClient.sendGraphCommand({ kind: "node.create", objectSpec: "osc~ 440" })).rejects.toThrow(
      "Runtime realtime WebSocket failed."
    );

    const closeClient = createRuntimeGraphCommandClient({
      WebSocketImpl: CloseBeforeOpenWebSocket
    });
    await expect(closeClient.sendGraphCommand({ kind: "node.create", objectSpec: "osc~ 440" })).rejects.toThrow(
      "Runtime realtime WebSocket closed before it opened."
    );
  });

  it("rejects invalid frames, runtime errors, and unsupported ACK payloads", async () => {
    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: InvalidFrameAfterHelloWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow();

    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: UnsupportedFrameAfterHelloWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime realtime returned an unsupported frame.");

    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: IncompleteFrameAfterHelloWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime realtime returned an incomplete frame.");

    const parse = JSON.parse;
    vi.spyOn(JSON, "parse").mockImplementation((text: string) => {
      if (text === "non-error-parse-failure") {
        throw "not an Error";
      }
      return parse(text);
    });
    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: NonErrorParseFailureAfterHelloWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime realtime returned an invalid frame.");
    vi.restoreAllMocks();

    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: RuntimeErrorAfterHelloWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime refused session.");

    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: RuntimeErrorWithoutIssueWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime realtime returned an error.");

    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: InvalidAckPayloadWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      })
    ).rejects.toThrow("Runtime graph ACK returned an unsupported payload.");
  });

  it("normalizes sparse graph ACK payloads without accepting malformed issues", async () => {
    const response = await createRuntimeGraphCommandClient({
      sessionId: null,
      WebSocketImpl: FallbackAckPayloadWebSocket
    }).sendGraphCommand({
      kind: "history.undo",
      scope: "client"
    }, {
      idempotencyKey: "undo-1"
    });

    expect(response).toMatchObject({
      applied: false,
      conflict: false,
      issues: [{ code: "runtime.graph.warning" }],
      ok: false,
      payload: {
        accepted: false,
        kind: "graph.command",
        status: "rejected",
        historySummary: {
          latestEntryId: null,
          canUndo: true,
          undoDepth: 2
        },
        target: { path: { kind: "root" } }
      }
    });
  });

  it("times out when the Runtime never sends the expected realtime frame", async () => {
    await expect(
      createRuntimeGraphCommandClient({ WebSocketImpl: NoAttachWebSocket }).sendGraphCommand({
        kind: "node.create",
        objectSpec: "osc~ 440"
      }, { timeoutMs: 5 })
    ).rejects.toThrow("Runtime realtime request timed out.");
  });
});
