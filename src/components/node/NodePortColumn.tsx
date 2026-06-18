import { Text } from "@mantine/core";
import { NodePortRow } from "./NodePortRow";
import type { NodePortHandleRenderer, NodePortSide, NodePortView } from "./nodeTypes";
import cardStyles from "./NodeCard.module.css";

export function NodePortColumn({
  ports,
  renderHandle,
  showInlineHandles = true,
  side
}: {
  ports: NodePortView[];
  renderHandle?: NodePortHandleRenderer;
  showInlineHandles?: boolean;
  side: NodePortSide;
}) {
  return (
    <div
      className={[
        cardStyles.column,
        side === "output" ? cardStyles.outputColumn : ""
      ].filter(Boolean).join(" ")}
    >
      <Text c="dimmed" className={cardStyles.columnTitle} size="10px" tt="uppercase">
        {side === "input" ? "IN" : "OUT"}
      </Text>
      {ports.length === 0 ? (
        <Text c="dimmed" className={cardStyles.empty} size="10px" ta={side === "input" ? "left" : "right"}>
          {side === "input" ? "No inlets" : "No outlets"}
        </Text>
      ) : null}
      {ports.map((port) => (
        <NodePortRow
          handle={showInlineHandles ? renderHandle?.(port, side) : false}
          key={port.id}
          port={port}
          side={side}
        />
      ))}
    </div>
  );
}
