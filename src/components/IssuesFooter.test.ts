// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
import type { DisplayGraphDocumentV01 as GraphDocumentV01 } from "../graph/patchLibrary";
import type { GraphSemanticIssue } from "../graph/portSemantics";
import { theme } from "../theme";
import { IssuesFooter, issueCounts } from "./IssuesFooter";

describe("IssuesFooter", () => {
  it("shows zero counts and graph lock state", () => {
    const html = renderToStaticMarkup(
      createElement(
        MantineProvider,
        { theme },
        createElement(IssuesFooter, {
          graphLockDisabled: false,
          graphLocked: true,
          onToggleGraphLock: () => undefined,
          semanticIssues: [],
          validation: { ok: true, value: graph() }
        })
      )
    );

    expect(html).toContain("aria-label=\"0 warnings\"");
    expect(html).toContain("aria-label=\"0 errors\"");
    expect(html).toContain("aria-label=\"Locked\"");
  });

  it("combines schema and semantic issues into footer counts", () => {
    expect(
      issueCounts(
        { errors: ["missing node"], ok: false },
        [
          issue("warning", "implicit conversion"),
          issue("error", "missing port")
        ]
      )
    ).toEqual({
      errors: 2,
      warnings: 1
    });
  });
});

function issue(
  severity: GraphSemanticIssue["severity"],
  message: string
): GraphSemanticIssue {
  return {
    code: message,
    message,
    severity
  };
}

function graph(): GraphDocumentV01 {
  return {
    edges: [],
    id: "graph",
    nodes: [],
    revision: "0",
    schema: "skenion.graph",
    schemaVersion: "0.1.0"
  };
}
