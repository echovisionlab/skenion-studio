import { Alert, Badge, Code, Group, Stack, Text } from "@mantine/core";
import type { GraphSemanticIssue } from "../../graph/portSemantics";

export function GraphIssuesPanel({ semanticIssues }: { semanticIssues: GraphSemanticIssue[] }) {
  const errorCount = semanticIssues.filter((issue) => issue.severity === "error").length;
  const warningCount = semanticIssues.filter((issue) => issue.severity === "warning").length;
  const color = errorCount === 0 ? (warningCount > 0 ? "yellow" : "gray") : "red";

  return (
    <Alert color={color} variant="light">
      <Group justify="space-between" wrap="nowrap">
        <Text fw={700} size="sm">
          Graph issues
        </Text>
        <Group gap={6} wrap="nowrap">
          <Badge color={errorCount > 0 ? "red" : "gray"} size="xs">
            {errorCount} errors
          </Badge>
          <Badge color={warningCount > 0 ? "yellow" : "gray"} size="xs">
            {warningCount} warnings
          </Badge>
        </Group>
      </Group>

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
