import { describe, expect, it } from "vitest";
import type { GraphPatchV01, RuntimeViewPatchOperation } from "@skenion/contracts";
import {
  createRuntimeGraphMutationRequest,
  createRuntimeViewMutationRequest
} from "./mutationRequest";

describe("runtime mutation requests", () => {
  it("builds view mutation requests without a hardcoded client identity", () => {
    const ops: RuntimeViewPatchOperation[] = [
      {
        op: "setNodeView",
        nodeId: "message_1",
        view: {
          x: 20,
          y: 40
        }
      }
    ];

    const request = createRuntimeViewMutationRequest({
      baseViewRevision: 7,
      description: "move object",
      ops
    });

    expect(request).toEqual({
      description: "move object",
      viewPatch: {
        baseViewRevision: 7,
        ops
      }
    });
    expect("clientId" in request).toBe(false);
  });

  it("builds graph mutation requests without a hardcoded client identity", () => {
    const graphPatch: GraphPatchV01 = {
      schema: "skenion.graph.patch",
      schemaVersion: "0.1.0",
      id: "patch_1",
      baseRevision: "rev_1",
      ops: []
    };

    const request = createRuntimeGraphMutationRequest(graphPatch);

    expect(request).toEqual({ graphPatch });
    expect("clientId" in request).toBe(false);
    expect(request.graphPatch).toBeDefined();
    expect("clientId" in request.graphPatch!).toBe(false);
  });
});
