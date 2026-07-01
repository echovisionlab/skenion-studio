import type {
  ProjectDocumentV01,
  RuntimeSessionLoadModeV01,
  RuntimeSessionLoadPreconditionV01
} from "@skenion/contracts";
import type { RuntimeProjectPayload, RuntimeSessionLoadPayload } from "./types";

export interface RuntimeSessionLoadRequestOptions {
  mode?: RuntimeSessionLoadModeV01;
  precondition?: RuntimeSessionLoadPreconditionV01;
}

export function createRuntimeProjectPayload(project: ProjectDocumentV01): RuntimeProjectPayload {
  return clone(project);
}

export function createRuntimeSessionLoadRequest(
  project: ProjectDocumentV01,
  options: RuntimeSessionLoadRequestOptions = {}
): RuntimeSessionLoadPayload {
  return {
    schema: "skenion.runtime.session-load-request",
    schemaVersion: "0.1.0",
    project: clone(project),
    mode: options.mode ?? "loadIfEmpty",
    ...(options.precondition ? { precondition: { ...options.precondition } } : {})
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
