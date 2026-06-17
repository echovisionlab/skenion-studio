import { Stack, Text, Textarea } from "@mantine/core";

export interface CommentControlsProps {
  text: string;
  onChange: (text: string) => void;
}

export function CommentControls({ onChange, text }: CommentControlsProps) {
  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Comment Graph Param
      </Text>
      <Textarea
        autosize
        label="Text"
        minRows={3}
        onChange={(event) => onChange(event.currentTarget.value)}
        size="xs"
        value={text}
      />
    </Stack>
  );
}
