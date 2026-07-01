import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Studio live mutation paths", () => {
  it("does not call disabled HTTP live mutation endpoints from App UI paths", () => {
    const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

    expect(appSource).not.toContain(".mutateSession(");
    expect(appSource).not.toContain(".runSessionOperation(");
    expect(appSource).not.toContain(".undoSessionPatch(");
    expect(appSource).not.toContain(".redoSessionPatch(");
    expect(appSource).not.toContain(".sendControlEvent(");
    expect(appSource).not.toContain("loadProjectIntoRuntime(nextProject");
    expect(appSource).not.toContain("runtimeSessionWithAcceptedProject");
    expect(appSource).not.toContain("setActiveProject(acceptedProject");
  });
});
