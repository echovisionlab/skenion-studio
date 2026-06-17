import { Group, NumberInput, Stack, Switch, Text, TextInput } from "@mantine/core";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  isReceiveNode,
  isSendNode,
  readChannelNameParam,
  readReceiveDefaultValue,
  receiveDataKind,
  sendDataKind
} from "../../graph/controlRouting";

export interface RoutingNodeControlsProps {
  node: GraphNodeV01;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
}

export function RoutingNodeControls({ node, onSetNodeParam }: RoutingNodeControlsProps) {
  if (!isSendNode(node) && !isReceiveNode(node)) {
    return null;
  }

  const dataKind = sendDataKind(node.kind) ?? receiveDataKind(node.kind) ?? "unknown";
  const receiveValue = isReceiveNode(node) ? readReceiveDefaultValue(node) : null;

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Typed Channel
      </Text>
      <TextInput
        label="Name"
        onChange={(event) => onSetNodeParam(node.id, "name", event.currentTarget.value)}
        size="xs"
        value={readChannelNameParam(node)}
      />
      <Text c="dimmed" size="xs">
        {dataKind}:{readChannelNameParam(node)}
      </Text>
      {receiveValue ? (
        <DefaultValueInput
          dataKind={dataKind}
          onChange={(value) => onSetNodeParam(node.id, "default", value)}
          value={receiveValue}
        />
      ) : null}
    </Stack>
  );
}

function DefaultValueInput({
  dataKind,
  onChange,
  value
}: {
  dataKind: string;
  value: ReturnType<typeof readReceiveDefaultValue>;
  onChange: (value: unknown) => void;
}) {
  if (value.type === "bool") {
    return (
      <Switch
        checked={value.value}
        label="Default"
        onChange={(event) => onChange(event.currentTarget.checked)}
        size="sm"
      />
    );
  }

  if (value.type === "rgba") {
    return (
      <Stack gap={4}>
        <Text c="dimmed" size="xs">
          Default
        </Text>
        <Group gap="xs" grow>
          {value.value.map((component, index) => (
            <NumberInput
              aria-label={`Default ${["R", "G", "B", "A"][index]}`}
              decimalScale={3}
              key={index}
              max={1}
              min={0}
              onChange={(nextValue) => {
                if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
                  return;
                }
                const next = [...value.value] as [number, number, number, number];
                next[index] = nextValue;
                onChange(next);
              }}
              size="xs"
              step={0.01}
              value={component}
            />
          ))}
        </Group>
      </Stack>
    );
  }

  return (
    <NumberInput
      decimalScale={dataKind === "number.i32" ? 0 : 3}
      label="Default"
      onChange={(nextValue) => {
        if (typeof nextValue !== "number" || !Number.isFinite(nextValue)) {
          return;
        }
        onChange(dataKind === "number.i32" ? Math.trunc(nextValue) : nextValue);
      }}
      size="xs"
      step={dataKind === "number.i32" ? 1 : 0.1}
      value={value.type === "i32" || value.type === "f32" ? value.value : 0}
    />
  );
}
