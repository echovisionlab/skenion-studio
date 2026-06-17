import { Stack, Text, TextInput } from "@mantine/core";

export interface StringValueControlsProps {
  label?: string;
  title?: string;
  value: string;
  onChange: (value: string) => void;
}

export function StringValueControls({
  label = "Value",
  onChange,
  title = "String Graph Param",
  value
}: StringValueControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        {title}
      </Text>
      <TextInput
        label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
        size="xs"
        value={value}
      />
    </Stack>
  );
}
