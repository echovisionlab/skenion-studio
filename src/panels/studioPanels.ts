export const STUDIO_PANEL_IDS = {
  inspector: "inspector",
  logs: "logs",
  nodes: "nodes",
  settings: "settings"
} as const;

export type StudioPanelId = typeof STUDIO_PANEL_IDS[keyof typeof STUDIO_PANEL_IDS];

export interface StudioPanelDefinition {
  hideLabel: string;
  id: StudioPanelId;
  showLabel: string;
  title: string;
}

export const STUDIO_PANELS = {
  [STUDIO_PANEL_IDS.inspector]: {
    hideLabel: "Hide inspector",
    id: STUDIO_PANEL_IDS.inspector,
    showLabel: "Inspector",
    title: "Inspector"
  },
  [STUDIO_PANEL_IDS.logs]: {
    hideLabel: "Hide logs",
    id: STUDIO_PANEL_IDS.logs,
    showLabel: "Logs",
    title: "Logs"
  },
  [STUDIO_PANEL_IDS.nodes]: {
    hideLabel: "Hide nodes",
    id: STUDIO_PANEL_IDS.nodes,
    showLabel: "Show nodes",
    title: "Nodes"
  },
  [STUDIO_PANEL_IDS.settings]: {
    hideLabel: "Hide settings",
    id: STUDIO_PANEL_IDS.settings,
    showLabel: "Settings",
    title: "Settings"
  }
} as const satisfies Record<StudioPanelId, StudioPanelDefinition>;

export function panelActionLabel(id: StudioPanelId, open: boolean): string {
  const panel = STUDIO_PANELS[id];
  return open ? panel.hideLabel : panel.showLabel;
}
