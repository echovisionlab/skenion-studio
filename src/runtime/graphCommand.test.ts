import { describe, expect, it } from "vitest";
import {
  createRuntimeGraphCommandClient,
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
        diagnostics: [],
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

  private emit(
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

describe("runtime graph command client", () => {
  it("builds a websocket URL from the Runtime HTTP base URL", () => {
    expect(runtimeRealtimeWebSocketUrl("http://127.0.0.1:3761", "skn-doc")).toBe(
      "ws://127.0.0.1:3761/v0/sessions/skn-doc"
    );
    expect(runtimeRealtimeWebSocketUrl("https://runtime.example", "shared")).toBe(
      "wss://runtime.example/v0/sessions/shared"
    );
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
});
