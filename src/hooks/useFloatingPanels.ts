import { useCallback, useMemo, useState } from "react";
import {
  clampFloatingPanelPosition,
  clampFloatingPanelSize,
  type FloatingPanelPosition
} from "../components/layout/FloatingPanel";
import { STUDIO_PANEL_IDS, type StudioPanelId } from "../panels/studioPanels";

export type FloatingPanelId = StudioPanelId;

const FLOATING_PANEL_BASE_Z_INDEX = 1_000;

export interface FloatingPanelState extends FloatingPanelPosition {
  open: boolean;
}

export interface FloatingPanelsState {
  bringPanelToFront: (id: FloatingPanelId) => void;
  closePanel: (id: FloatingPanelId) => void;
  movePanel: (id: FloatingPanelId, position: { x: number; y: number }) => void;
  openPanel: (id: FloatingPanelId) => void;
  panels: Record<FloatingPanelId, FloatingPanelState>;
  resizePanel: (id: FloatingPanelId, size: { height: number; width: number }) => void;
  togglePanel: (id: FloatingPanelId) => void;
}

export function useFloatingPanels(): FloatingPanelsState {
  const [panels, setPanels] = useState(() => initialFloatingPanels());

  const highestZIndex = useCallback((current: Record<FloatingPanelId, FloatingPanelState>) => (
    Math.max(...Object.values(current).map((panel) => panel.zIndex))
  ), []);

  const openPanel = useCallback((id: FloatingPanelId) => {
    setPanels((current) => {
      const panel = current[id];
      const nextZIndex = highestZIndex(current) + 1;
      if (panel.open && panel.zIndex === nextZIndex - 1) {
        return current;
      }
      return {
        ...current,
        [id]: {
          ...panel,
          open: true,
          zIndex: nextZIndex
        }
      };
    });
  }, [highestZIndex]);

  const closePanel = useCallback((id: FloatingPanelId) => {
    setPanels((current) => {
      const panel = current[id];
      if (!panel.open) {
        return current;
      }
      return {
        ...current,
        [id]: {
          ...panel,
          open: false
        }
      };
    });
  }, []);

  const togglePanel = useCallback((id: FloatingPanelId) => {
    setPanels((current) => {
      const panel = current[id];
      return {
        ...current,
        [id]: {
          ...panel,
          open: !panel.open,
          zIndex: panel.open ? panel.zIndex : highestZIndex(current) + 1
        }
      };
    });
  }, [highestZIndex]);

  const bringPanelToFront = useCallback((id: FloatingPanelId) => {
    setPanels((current) => {
      const panel = current[id];
      const nextZIndex = highestZIndex(current) + 1;
      if (panel.zIndex === nextZIndex - 1) {
        return current;
      }
      return {
        ...current,
        [id]: {
          ...panel,
          zIndex: nextZIndex
        }
      };
    });
  }, [highestZIndex]);

  const movePanel = useCallback((id: FloatingPanelId, position: { x: number; y: number }) => {
    setPanels((current) => {
      const panel = current[id];
      const next = clampFloatingPanelPosition(position, panel);
      if (panel.x === next.x && panel.y === next.y) {
        return current;
      }
      return {
        ...current,
        [id]: {
          ...panel,
          ...next
        }
      };
    });
  }, []);

  const resizePanel = useCallback((id: FloatingPanelId, size: { height: number; width: number }) => {
    setPanels((current) => {
      const panel = current[id];
      const next = clampFloatingPanelSize(size, panel);
      if (panel.height === next.height && panel.width === next.width) {
        return current;
      }
      return {
        ...current,
        [id]: {
          ...panel,
          ...next
        }
      };
    });
  }, []);

  return useMemo(() => ({
    bringPanelToFront,
    closePanel,
    movePanel,
    openPanel,
    panels,
    resizePanel,
    togglePanel
  }), [bringPanelToFront, closePanel, movePanel, openPanel, panels, resizePanel, togglePanel]);
}

function initialFloatingPanels(): Record<FloatingPanelId, FloatingPanelState> {
  const viewport = currentViewport();
  const inspectorWidth = 360;
  const nodesWidth = 292;
  const settingsWidth = Math.min(720, Math.max(320, viewport.width - 80));
  const settingsHeight = Math.min(620, Math.max(360, viewport.height - 96));

  return {
    [STUDIO_PANEL_IDS.inspector]: {
      height: Math.min(560, Math.max(360, viewport.height - 92)),
      open: false,
      width: inspectorWidth,
      x: Math.max(40, viewport.width - inspectorWidth - 42),
      y: 50,
      zIndex: FLOATING_PANEL_BASE_Z_INDEX + 2
    },
    [STUDIO_PANEL_IDS.logs]: {
      height: Math.min(320, Math.max(220, viewport.height - 120)),
      open: false,
      width: Math.min(560, Math.max(360, viewport.width - 96)),
      x: 58,
      y: Math.max(50, viewport.height - 362),
      zIndex: FLOATING_PANEL_BASE_Z_INDEX + 3
    },
    [STUDIO_PANEL_IDS.nodes]: {
      height: Math.min(560, Math.max(360, viewport.height - 92)),
      open: true,
      width: nodesWidth,
      x: 34,
      y: 50,
      zIndex: FLOATING_PANEL_BASE_Z_INDEX + 1
    },
    [STUDIO_PANEL_IDS.settings]: {
      height: settingsHeight,
      open: false,
      width: settingsWidth,
      x: Math.max(40, Math.round((viewport.width - settingsWidth) / 2)),
      y: 52,
      zIndex: FLOATING_PANEL_BASE_Z_INDEX + 4
    }
  };
}

function currentViewport() {
  if (typeof window === "undefined") {
    return { height: 720, width: 1024 };
  }
  return {
    height: window.innerHeight,
    width: window.innerWidth
  };
}
