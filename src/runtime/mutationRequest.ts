import type {
  GraphPatchV01,
  RuntimeMutationRequest,
  RuntimeViewPatchOperation
} from "@skenion/contracts";

export interface RuntimeViewMutationRequestInput {
  baseViewRevision: number;
  description: string;
  ops: RuntimeViewPatchOperation[];
}

export function createRuntimeViewMutationRequest(
  input: RuntimeViewMutationRequestInput
): RuntimeMutationRequest {
  return {
    description: input.description,
    viewPatch: {
      baseViewRevision: input.baseViewRevision,
      ops: input.ops
    }
  };
}

export function createRuntimeGraphMutationRequest(
  graphPatch: GraphPatchV01
): RuntimeMutationRequest {
  return {
    graphPatch
  };
}
