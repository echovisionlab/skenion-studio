import type { RuntimeClient } from "./client";
import type {
  RuntimeGraphCommandClient,
  RuntimeGraphCommandPayload,
  RuntimeGraphCommandResponse
} from "./graphCommand";
import type { RuntimeSessionResponse } from "./types";

export interface RuntimeGraphCommandExecution {
  response: RuntimeGraphCommandResponse;
  session: RuntimeSessionResponse;
}

export async function sendRuntimeGraphCommandAndRefresh(options: {
  graphCommandClient: RuntimeGraphCommandClient;
  payload: RuntimeGraphCommandPayload;
  refreshRuntimeProject: (client: RuntimeClient) => Promise<RuntimeSessionResponse>;
  runtimeClient: RuntimeClient;
}): Promise<RuntimeGraphCommandExecution> {
  const response = await options.graphCommandClient.sendGraphCommand(options.payload);
  const session = await options.refreshRuntimeProject(options.runtimeClient);
  return { response, session };
}

export function runtimeGraphCommandRejectionMessage(
  response: RuntimeGraphCommandResponse,
  fallback: string
): string | null {
  if (response.ok && response.applied) {
    return null;
  }

  return response.issues[0]?.message ?? fallback;
}
