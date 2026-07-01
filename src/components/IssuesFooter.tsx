import { Group, Text, Tooltip } from "@mantine/core";
import { CircleAlert, Lock, TriangleAlert, Unlock } from "lucide-react";
import type { ValidationResult } from "@skenion/contracts";
import type { DisplayGraphDocumentV01 } from "../graph/patchLibrary";
import type { GraphSemanticIssue } from "../graph/portSemantics";
import { IconButton } from "./core/IconButton/IconButton";
import styles from "./IssuesFooter.module.css";

export interface IssueCounts {
  errors: number;
  warnings: number;
}

export function issueCounts(
  validation: ValidationResult<DisplayGraphDocumentV01>,
  semanticIssues: GraphSemanticIssue[]
): IssueCounts {
  const semanticErrors = semanticIssues.filter((issue) => issue.severity === "error").length;
  const warnings = semanticIssues.filter((issue) => issue.severity === "warning").length;
  return {
    errors: validation.ok ? semanticErrors : semanticErrors + validation.errors.length,
    warnings
  };
}

export function IssuesFooter({
  graphLockDisabled,
  graphLocked,
  semanticIssues,
  validation,
  onToggleGraphLock
}: {
  graphLockDisabled: boolean;
  graphLocked: boolean;
  semanticIssues: GraphSemanticIssue[];
  validation: ValidationResult<DisplayGraphDocumentV01>;
  onToggleGraphLock: () => void;
}) {
  const counts = issueCounts(validation, semanticIssues);

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
        <Tooltip label={`${counts.warnings} warnings`}>
          <Group
            aria-label={`${counts.warnings} warnings`}
            className={styles.count}
            data-active={counts.warnings > 0 || undefined}
            data-kind="warning"
            gap={4}
            wrap="nowrap"
          >
            <TriangleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.warnings}
            </Text>
          </Group>
        </Tooltip>
        <Tooltip label={`${counts.errors} errors`}>
          <Group
            aria-label={`${counts.errors} errors`}
            className={styles.count}
            data-active={counts.errors > 0 || undefined}
            data-kind="error"
            gap={4}
            wrap="nowrap"
          >
            <CircleAlert size={13} />
            <Text component="span" fw={800} size="xs">
              {counts.errors}
            </Text>
          </Group>
        </Tooltip>
      </Group>
    </Group>
  );
}
