import { Group, Text, Tooltip } from "@mantine/core";
import { CircleAlert, Lock, TriangleAlert, Unlock } from "lucide-react";
import type { GraphSemanticIssue } from "../graph/portSemantics";
import { IconButton } from "./core/IconButton/IconButton";
import styles from "./IssuesFooter.module.css";

export interface IssueCounts {
  errors: number;
  warnings: number;
}

export function issueCounts(semanticIssues: GraphSemanticIssue[]): IssueCounts {
  const semanticErrors = semanticIssues.filter((issue) => issue.severity === "error").length;
  const warnings = semanticIssues.filter((issue) => issue.severity === "warning").length;
  return {
    errors: semanticErrors,
    warnings
  };
}

export function IssuesFooter({
  graphLockDisabled,
  graphLocked,
  semanticIssues,
  onOpenIssues,
  onToggleGraphLock
}: {
  graphLockDisabled: boolean;
  graphLocked: boolean;
  semanticIssues: GraphSemanticIssue[];
  onOpenIssues?: () => void;
  onToggleGraphLock: () => void;
}) {
  const counts = issueCounts(semanticIssues);

  return (
    <Group className={styles.footer} justify="space-between" wrap="nowrap">
      <Tooltip label={graphLocked ? "Locked: click to unlock" : "Unlocked: click to lock"}>
        <IconButton
          className={styles.lock}
          disabled={graphLockDisabled}
          icon={graphLocked ? <Lock size={13} /> : <Unlock size={13} />}
          label={graphLocked ? "Locked" : "Unlocked"}
          onClick={onToggleGraphLock}
          size={24}
        />
      </Tooltip>

      <Group gap="xs" wrap="nowrap">
        <Tooltip label={`Graph issues: ${counts.warnings} warnings`}>
          <button
            aria-label={`Graph issues: ${counts.warnings} warnings`}
            className={styles.count}
            data-active={counts.warnings > 0 || undefined}
            data-kind="warning"
            onClick={onOpenIssues}
            type="button"
          >
            <TriangleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.warnings}
            </Text>
          </button>
        </Tooltip>
        <Tooltip label={`Graph issues: ${counts.errors} errors`}>
          <button
            aria-label={`Graph issues: ${counts.errors} errors`}
            className={styles.count}
            data-active={counts.errors > 0 || undefined}
            data-kind="error"
            onClick={onOpenIssues}
            type="button"
          >
            <CircleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.errors}
            </Text>
          </button>
        </Tooltip>
      </Group>
    </Group>
  );
}
