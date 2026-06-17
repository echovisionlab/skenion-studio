import { Stack, Switch, Text } from "@mantine/core";

export interface BooleanValueControlsProps {
  title?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanValueControls({ onChange, title = "Boolean Graph Param", value }: BooleanValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        {title}
      </Text>
      <Switch
        checked={value}
        label="Value"
        onChange={(event) => onChange(event.currentTarget.checked)}
        size="sm"
      />
    </Stack>
  );
}
