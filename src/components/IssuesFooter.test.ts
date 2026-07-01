// @vitest-environment happy-dom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it } from "vitest";
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
          semanticIssues: []
        })
      )
    );

    expect(html).toContain("aria-label=\"Graph issues: 0 warnings\"");
    expect(html).toContain("aria-label=\"Graph issues: 0 errors\"");
    expect(html).toContain("aria-label=\"Locked\"");
  });

  it("counts semantic graph issues without schema validation failures", () => {
    expect(
      issueCounts([
        issue("warning", "implicit conversion"),
        issue("error", "missing port")
      ])
    ).toEqual({
      errors: 1,
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
