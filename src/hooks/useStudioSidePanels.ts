import { useCallback, useState } from "react";

export interface StudioSidePanelState {
  closeSidePanel: () => void;
  logsOpen: boolean;
  openInspectSidePanel: () => void;
  openLogsSidePanel: () => void;
  sidePanelOpen: boolean;
}

export function useStudioSidePanels(): StudioSidePanelState {
  const [sidePanelOpen, setSidePanelOpen] = useState(true);
  const [logsOpen, setLogsOpen] = useState(false);

  const openInspectSidePanel = useCallback(() => {
    setLogsOpen((current) => current ? false : current);
    setSidePanelOpen((current) => current ? current : true);
  }, []);

  const openLogsSidePanel = useCallback(() => {
    setLogsOpen((current) => current ? current : true);
    setSidePanelOpen((current) => current ? current : true);
  }, []);

  const closeSidePanel = useCallback(() => {
    setLogsOpen(false);
    setSidePanelOpen(false);
  }, []);

  return {
    closeSidePanel,
    logsOpen,
    openInspectSidePanel,
    openLogsSidePanel,
    sidePanelOpen
  };
}
