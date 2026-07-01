import { useCallback, useState } from "react";

export interface StudioSidePanelState {
  closeSidePanel: () => void;
  inspectorEdgeHovered: boolean;
  logsOpen: boolean;
  openInspectSidePanel: () => void;
  openLogsSidePanel: () => void;
  setInspectorEdgeHovered: (hovered: boolean) => void;
  sidePanelOpen: boolean;
  toggleInspectSidePanel: () => void;
}

export function useStudioSidePanels(): StudioSidePanelState {
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [inspectorEdgeHovered, setInspectorEdgeHoveredState] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  const openInspectSidePanel = useCallback(() => {
    setLogsOpen((current) => current ? false : current);
    setSidePanelOpen((current) => current ? current : true);
  }, []);

  const openLogsSidePanel = useCallback(() => {
    setLogsOpen((current) => current ? current : true);
    setSidePanelOpen((current) => current ? current : true);
  }, []);

  const toggleInspectSidePanel = useCallback(() => {
    setSidePanelOpen((open) => {
      setLogsOpen(false);
      return !open;
    });
  }, []);

  const closeSidePanel = useCallback(() => {
    setInspectorEdgeHoveredState(false);
    setLogsOpen(false);
    setSidePanelOpen(false);
  }, []);

  const setInspectorEdgeHovered = useCallback((hovered: boolean) => {
    setInspectorEdgeHoveredState((current) => current === hovered ? current : hovered);
  }, []);

  return {
    closeSidePanel,
    inspectorEdgeHovered,
    logsOpen,
    openInspectSidePanel,
    openLogsSidePanel,
    setInspectorEdgeHovered,
    sidePanelOpen,
    toggleInspectSidePanel
  };
}
