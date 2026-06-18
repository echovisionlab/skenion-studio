import type { CSSProperties } from "react";
import { NodeHeader } from "./NodeHeader";
import { NodePortColumn } from "./NodePortColumn";
import { NodePortHandle } from "./NodePortHandle";
import type { NodeCardView, NodePortHandleRenderer, NodePortSide, NodePortView } from "./nodeTypes";
import cardStyles from "./NodeCard.module.css";
import socketStyles from "./PortSocket.module.css";

export interface NodeCardProps extends NodeCardView {
  renderInputHandle?: NodePortHandleRenderer;
  renderOutputHandle?: NodePortHandleRenderer;
}

export function NodeCard({
  accentColor = "#868e96",
  inputs,
  kind,
  label,
  outputs,
  renderInputHandle,
  renderOutputHandle,
  selected,
  typeBadgeLabel
}: NodeCardProps) {
  const style = { "--node-accent": accentColor } as CSSProperties;
  const rootClassName = [cardStyles.root, selected ? cardStyles.rootSelected : ""].filter(Boolean).join(" ");

  return (
    <div className={rootClassName} style={style}>
      <div className={cardStyles.body}>
        <CardPortRail ports={inputs} renderHandle={renderInputHandle} side="input" />
        <NodeHeader className={cardStyles.header} kind={kind} label={label} typeBadgeLabel={typeBadgeLabel} />
        <div className={cardStyles.ports}>
          <NodePortColumn ports={inputs} showInlineHandles={false} side="input" />
          <NodePortColumn ports={outputs} showInlineHandles={false} side="output" />
        </div>
        <CardPortRail ports={outputs} renderHandle={renderOutputHandle} side="output" />
      </div>
    </div>
  );
}

function CardPortRail({
  ports,
  renderHandle,
  side
}: {
  ports: NodePortView[];
  renderHandle?: NodePortHandleRenderer;
  side: NodePortSide;
}) {
  if (ports.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        cardStyles.rail,
        side === "input" ? cardStyles.railInput : cardStyles.railOutput
      ].join(" ")}
    >
      {ports.map((port) => (
        <div className={socketStyles.slot} key={port.id} title={`${port.id}: ${port.typeLabel}`}>
          {renderHandle?.(port, side) ?? <NodePortHandle color={port.color} />}
        </div>
      ))}
    </div>
  );
}
