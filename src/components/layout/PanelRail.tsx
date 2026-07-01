import type { ReactNode } from "react";
import { Tooltip } from "@mantine/core";
import { IconButton } from "../core/IconButton/IconButton";
import styles from "./PanelRail.module.css";

export type PanelRailEdge = "bottom" | "left" | "right" | "top";

export interface PanelRailItem {
  disabled?: boolean;
  icon: ReactNode;
  id: string;
  label: string;
  onClick?: () => void;
  selected?: boolean;
}

export interface PanelRailProps {
  edge: PanelRailEdge;
  items?: PanelRailItem[];
}

export function PanelRail({
  edge,
  items = []
}: PanelRailProps) {
  const orientation = edge === "left" || edge === "right" ? "vertical" : "horizontal";
  return (
    <nav
      aria-label={`${edge} panel actions`}
      className={styles.rail}
      data-edge={edge}
      data-orientation={orientation}
    >
      {items.map((item) => (
        <Tooltip key={item.id} label={item.label} position={tooltipPosition(edge)}>
          <div className={styles.item}>
            <IconButton
              disabled={item.disabled}
              icon={item.icon}
              label={item.label}
              onClick={item.onClick}
              selected={item.selected}
              size={34}
            />
          </div>
        </Tooltip>
      ))}
    </nav>
  );
}

export interface WorkspaceSideDockProps {
  children?: ReactNode;
  contentOpen?: boolean;
  edge: "left" | "right";
  railItems?: PanelRailItem[];
}

export function WorkspaceSideDock({
  children,
  contentOpen = true,
  edge,
  railItems = []
}: WorkspaceSideDockProps) {
  const rail = <PanelRail edge={edge} items={railItems} />;
  const content = contentOpen ? <div className={styles.content}>{children}</div> : null;
  return (
    <div className={styles.dock} data-edge={edge}>
      {edge === "left" ? rail : content}
      {edge === "left" ? content : rail}
    </div>
  );
}

function tooltipPosition(edge: PanelRailEdge) {
  switch (edge) {
    case "left":
      return "right" as const;
    case "right":
      return "left" as const;
    case "bottom":
      return "top" as const;
    case "top":
    default:
      return "bottom" as const;
  }
}
