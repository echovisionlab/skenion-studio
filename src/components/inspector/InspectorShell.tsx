import { Stack } from "@mantine/core";
import type { ReactNode } from "react";

export function InspectorShell({
  children
}: {
  children: ReactNode;
}) {
  return (
    <Stack className="panel-shell" gap="md">
      {children}
    </Stack>
  );
}
