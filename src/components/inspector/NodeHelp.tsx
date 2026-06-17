import { Stack, Text } from "@mantine/core";
import type { BuiltinNodeHelpV01 } from "@skenion/contracts";

export function NodeHelp({ help }: { help: BuiltinNodeHelpV01 }) {
  return (
    <Stack
      gap={6}
      p="xs"
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 6
      }}
    >
      <Text fw={800} size="sm">
        {help.summary}
      </Text>
      <Text c="dimmed" size="xs">
        {help.description}
      </Text>
      {help.ports?.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Ports
          </Text>
          {help.ports.map((port) => (
            <Text c="dimmed" key={port.id} size="xs">
              {port.id}: {port.description}
            </Text>
          ))}
        </Stack>
      ) : null}
      {help.params?.length ? (
        <Stack gap={3}>
          <Text fw={700} size="xs">
            Params
          </Text>
          {help.params.map((param) => (
            <Text c="dimmed" key={param.id} size="xs">
              {param.id}: {param.description}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
