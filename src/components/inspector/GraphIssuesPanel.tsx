import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import type { ValidationResult } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../../graph/patchLibrary";
import type { GraphSemanticIssue } from "../../graph/portSemantics";

export function GraphIssuesPanel({
  semanticIssues,
  validation
}: {
  semanticIssues: GraphSemanticIssue[];
  validation: ValidationResult<DisplayGraphDocumentV01>;
}) {
  const errorCount = semanticIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = semanticIssues.filter((issue) => issue.severity === "warning").length;
  const color = validation.ok && errorCount === 0 ? (warningCount > 0 ? "yellow" : "gray") : "red";

  return (
    <Alert color={color} variant="light">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          Graph issues
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={errorCount > 0 || !validation.ok ? "red" : "gray"} size="xs">
            {validation.ok ? errorCount : errorCount + validation.errors.length} errors
          </Badge>
          <Badge color={warningCount > 0 ? "yellow" : "gray"} size="xs">
            {warningCount} warnings
          </Badge>
        </Group>
      </Group>

      {!validation.ok ? (
        <Stack gap={4} mt="xs">
          {validation.errors.slice(0, 4).map((error) => (
            <Code block key={error}>
              {error}
            </Code>
          ))}
        </Stack>
      ) : null}

      {semanticIssues.length > 0 ? (
        <Stack gap={4} mt="xs">
          {semanticIssues.slice(0, 5).map((issue) => (
            <Code block key={`${issue.code}:${issue.message}`}>
              {issue.severity}: {issue.code} · {issue.message}
            </Code>
          ))}
        </Stack>
      ) : null}
    </Alert>
  );
}
