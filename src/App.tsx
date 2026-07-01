import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppShell, Badge, Group, Stack, Text } from "@mantine/core";
import { Box as BoxIcon, CircleAlert, PanelRightOpen, ScrollText, X } from "lucide-react";
import {
  type GraphFragmentV01,
  type NodeCatalogSnapshotV01,
  type PasteGraphFragmentRequest,
  type ProjectDocumentV01,
  type ViewStateV01
} from "@skenion/contracts";
import { validatePasteGraphFragmentRequest } from "@skenion/contracts";
import { GraphCanvas } from "./components/GraphCanvas";
import { IssuesFooter } from "./components/IssuesFooter";
import { InspectorPanel } from "./components/InspectorPanel";
import { PalettePanel } from "./components/PalettePanel";
import { RuntimeLogsPanel, RuntimeSettingsPanel } from "./components/RuntimePanel";
import { StudioToolbar } from "./components/StudioToolbar";
import { IconButton } from "./components/core/IconButton/IconButton";
import { FloatingPanel } from "./components/layout/FloatingPanel";
import { PanelRail, type PanelRailItem } from "./components/layout/PanelRail";
import { clientLogLine, runtimeLogLineFromEvent, type LogLevel, type LogLine } from "./components/log/LogConsole";
import {
  applyPatch,
  validateGraph,
  type ConnectionCheck,
  type GraphPatch
} from "./graph/skenionGraph";
import { applyActiveProjectPatches } from "./graph/activeProject";
import {
  activeProjectDisplayGraph,
  createProjectDocument,
  createViewStateFromPositions,
  parseGraphDocumentAsActiveProject,
  parseProjectDocument,
  reconcileViewStateWithGraph,
  replaceProjectRootGraphFromDisplay,
  updateProjectViewState
} from "./graph/projectDocument";
import {
  canvasViewportEquals,
  DEFAULT_CANVAS_VIEWPORT,
  type CanvasViewport
} from "./graph/viewport";
import {
  readCachedViewport,
  writeCachedViewport,
  type ViewportCacheSurface
} from "./graph/viewportCache";
import { videoAssetSizeForSource } from "./graph/videoAsset";
import {
  analyzeGraphPortSemantics,
  findEdgeInspectorModel
} from "./graph/portSemantics";
import {
  displayEdgeToEdgeSpec,
  type DisplayGraphDocumentV01,
  type DisplayGraphNodeV01
} from "./graph/patchLibrary";
import {
  isUnsignedIntRepresentation,
  readIntRepresentationParam
} from "./graph/intValue";
import {
  createGraphFragmentFromSelection,
  graphClipboardShortcutAction,
  graphFragmentPasteAvailability,
  type GraphFragmentBuildResult,
  parseGraphFragmentClipboard,
  serializeGraphFragmentClipboard
} from "./graph/fragmentClipboard";
import { createReplaceShaderInterfacePatch } from "./graph/fullscreenShader";
import {
  createRuntimeClient,
  isRuntimeSessionEvent,
  isRuntimeLogEvent,
  runtimeLogStreamUrl,
  runtimeSessionEventsStreamUrl,
  RuntimeClientError,
  type RuntimeClient
} from "./runtime/client";
import { createRuntimeSessionLoadRequest } from "./runtime/payload";
import {
  createRuntimeGraphCommandClient,
  type RuntimeGraphCommandClient,
  type RuntimeGraphCommandResponse
} from "./runtime/graphCommand";
import {
  runtimeGraphCommandRejectionMessage,
  sendRuntimeGraphCommandAndRefresh
} from "./runtime/graphCommandExecution";
import {
  runtimeGraphFingerprint,
  runtimeSessionFingerprint,
  runtimeSessionIsSynced
} from "./runtime/sessionSync";
import {
  rootGraphTarget,
  runtimeCommandGroupsFromGraphPatches,
  runtimeGraphCommandPayloadForPatchGroup
} from "./runtime/liveGraphPatches";
import { runtimeControlValueEquals } from "./runtime/controlMessage";
import type {
  RuntimeConnectionStatus,
  RuntimeControlEventRequest,
  RuntimeControlStateResponse,
  RuntimeControlValue,
  RuntimeGeneratedShaderResponse,
  RuntimeHistory,
  RuntimeInfo,
  RuntimePreviewStatus,
  RuntimeSessionEvent,
  RuntimeSessionResponse,
  RuntimeTelemetrySnapshot,
  RuntimeViewPatchOperation
} from "./runtime/types";
import { runtimeHistoryActionAvailability } from "./runtime/historySync";
import { runtimeHistoryShortcutAction, type RuntimeHistoryShortcutAction } from "./runtime/historyShortcuts";
import {
  readDesktopLaunchContext,
  resolveStudioWindowId
} from "./desktop/launchContext";
import {
  readCachedRuntimeConnectionPreference,
  writeCachedRuntimeConnectionPreference
} from "./desktop/runtimeConnectionCache";
import {
  DEFAULT_RUNTIME_SESSION_ID,
  activeRuntimeProfile,
  applyRuntimeSidecarError,
  applyRuntimeSidecarStarted,
  applyRuntimeSidecarStopped,
  createRuntimeProfileState,
  planRuntimeConnect,
  switchRuntimeProfile,
  updateRuntimeProfileUrl,
  type RuntimeProfileEffect,
  type RuntimeProfileId
} from "./desktop/runtimeProfiles";
import {
  createTauriDesktopBridge
} from "./desktop/tauriBridge";
import {
  createIsolatedRuntimeScope,
  createSharedRuntimeScope,
  createStudioWindowId,
  createWindowRegistry,
  registerRuntimeWindow,
  updateWindowLocalState,
  updateWindowRuntimeScope,
  windowsForRuntimeSession,
  type StudioWindowMode,
  type StudioWindowRegistry
} from "./desktop/windowRegistry";
import { useFloatingPanels } from "./hooks/useFloatingPanels";
import { useStudioSelection } from "./hooks/useStudioSelection";
import { useApplicationShortcuts, type GraphPointerPosition } from "./hooks/useApplicationShortcuts";

const emptyRuntimeControlValues: Record<string, RuntimeControlValue> = {};

export default function App() {
  const [launchContext] = useState(() => readDesktopLaunchContext());
  const [runtimeConnectionPreference] = useState(() => readCachedRuntimeConnectionPreference());
  const [desktopBridge] = useState(() => createTauriDesktopBridge());
  const [studioWindowId] = useState(() =>
    resolveStudioWindowId({
      launchWindowId: launchContext.windowId,
      tauriWindowLabel: desktopBridge.currentWindowLabel
    })
  );
  const [runtimeSessionId] = useState(() =>
    runtimeConnectionPreference?.sessionId ?? launchContext.sessionId ?? DEFAULT_RUNTIME_SESSION_ID
  );
  const [runtimeProfileState, setRuntimeProfileState] = useState(() =>
    createRuntimeProfileState({
      activeProfileId: runtimeConnectionPreference?.activeProfileId ?? launchContext.profileId,
      defaultRuntimeUrl: launchContext.runtimeUrl,
      remoteRuntimeUrl: runtimeConnectionPreference?.remoteRuntimeUrl ?? launchContext.runtimeUrl
    })
  );
  const [autoConnectRuntimeOnMount] = useState(
    () => runtimeConnectionPreference?.autoConnect === true
  );
  const viewportCacheSurface: ViewportCacheSurface = desktopBridge.available ? "desktop" : "web";
  const [activeProject, setActiveProject] = useState<ProjectDocumentV01>(() => createUntitledProject());
  const graph = useMemo(() => activeProjectDisplayGraph(activeProject), [activeProject]);
  const viewState = activeProject.viewState;
  const [editingObjectSpecNodeId, setEditingObjectSpecNodeId] = useState<string | null>(null);
  const [graphFragmentClipboard, setGraphFragmentClipboard] = useState<GraphFragmentV01 | null>(null);
  const {
    bringPanelToFront,
    closePanel,
    movePanel,
    openPanel,
    panels,
    resizePanel,
    togglePanel
  } = useFloatingPanels();
  const openInspectSidePanel = useCallback(() => {
    openPanel("inspector");
  }, [openPanel]);
  const [clientLogLines, setClientLogLines] = useState<LogLine[]>([]);
  const [runtimeStreamLogLines, setRuntimeStreamLogLines] = useState<LogLine[]>([]);
  const [graphLocked, setGraphLocked] = useState(true);
  const [importError, setImportError] = useState<string | null>(null);
  const [runtimeUrl, setRuntimeUrl] = useState(() => activeRuntimeProfile(runtimeProfileState).url);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeConnectionStatus>("disconnected");
  const [runtimeBusyAction, setRuntimeBusyAction] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null);
  const [nodeCatalog, setNodeCatalog] = useState<NodeCatalogSnapshotV01 | null>(null);
  const [runtimeSession, setRuntimeSession] = useState<RuntimeSessionResponse | null>(null);
  const [runtimeControlState, setRuntimeControlState] = useState<RuntimeControlStateResponse | null>(null);
  const [runtimeControlPulses, setRuntimeControlPulses] = useState<Record<string, number>>({});
  const runtimeControlPulseCounterRef = useRef(0);
  const graphPointerPositionRef = useRef<GraphPointerPosition | null>(null);
  const lastGraphPointerPositionRef = useRef<GraphPointerPosition | null>(null);
  const [runtimeHistory, setRuntimeHistory] = useState<RuntimeHistory | null>(null);
  const [runtimePreviewStatus, setRuntimePreviewStatus] = useState<RuntimePreviewStatus | null>(null);
  const [, setRuntimeTelemetry] = useState<RuntimeTelemetrySnapshot | null>(null);
  const [generatedShader, setGeneratedShader] = useState<RuntimeGeneratedShaderResponse | null>(null);
  const [lastLoadedGraphFingerprint, setLastLoadedGraphFingerprint] = useState<string | null>(null);
  const [, setPendingPatchBaseRevision] = useState<string | null>(null);
  const [, setPatchConflict] = useState<string | null>(null);
  const autoConnectAttemptedRef = useRef(false);
  const connectRuntimeRef = useRef<() => Promise<void>>(async () => undefined);
  const currentWindowMode = launchContext.windowMode;
  const [windowRegistry, setWindowRegistry] = useState<StudioWindowRegistry>(() =>
    hydrateInitialViewport(
      createWindowRegistry({
        scope: createRuntimeScope({
          profileId: runtimeProfileState.activeProfileId,
          runtimeUrl: launchContext.runtimeUrl,
          sessionId: runtimeSessionId,
          windowId: studioWindowId,
          windowMode: currentWindowMode
        }),
        windowId: studioWindowId
      }),
      {
        project: activeProject,
        studioWindowId,
        surface: viewportCacheSurface
      }
    )
  );
  const canvasViewport = windowRegistry.windows[studioWindowId]?.localState.viewport ?? DEFAULT_CANVAS_VIEWPORT;
  const {
    handleCanvasSelectionChange,
    pruneSelection,
    selectSingleNode,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds
  } = useStudioSelection({
    openInspector: openInspectSidePanel,
    setWindowRegistry,
    studioWindowId
  });
  const validation = useMemo(() => validateGraph(graph), [graph]);
  const validationErrorLogFingerprintRef = useRef<string | null>(null);
  const semanticIssues = useMemo(() => analyzeGraphPortSemantics(graph), [graph]);
  const semanticIssueLogFingerprintRef = useRef<string | null>(null);
  const currentRuntimeScope = useMemo(
    () =>
      createRuntimeScope({
        profileId: runtimeProfileState.activeProfileId,
        runtimeUrl,
        sessionId: runtimeSessionId,
        windowId: studioWindowId,
        windowMode: currentWindowMode
      }),
    [currentWindowMode, runtimeProfileState.activeProfileId, runtimeSessionId, runtimeUrl, studioWindowId]
  );
  const currentRuntimeWindowCount = useMemo(
    () => windowsForRuntimeSession(windowRegistry, currentRuntimeScope).length || 1,
    [currentRuntimeScope, windowRegistry]
  );
  const runtimeSessionSynced = runtimeSessionIsSynced(
    runtimeStatus,
    runtimeSession,
    runtimeGraphFingerprint(graph.id, graph.revision),
    lastLoadedGraphFingerprint
  );
  const runtimeControlInteractionEnabled =
    runtimeStatus === "connected" &&
    runtimeSessionSynced &&
    runtimeSessionLoaded(runtimeSession) &&
    runtimeSupportsControl(runtimeInfo) &&
    runtimeSupportsControlState(runtimeInfo);
  const runtimeControlValuesForSession =
    runtimeSessionSynced ? runtimeControlState?.values ?? emptyRuntimeControlValues : emptyRuntimeControlValues;
  const runtimeGraphAvailable =
    runtimeStatus === "connected" &&
    runtimeSessionSynced &&
    runtimeSessionLoaded(runtimeSession);
  useApplicationShortcuts({
    enabled: runtimeGraphAvailable,
    getGraphPointerPosition: () => graphPointerPositionRef.current,
    onCreateObjectAtPosition: createShortcutObjectAtPosition,
    onToggleGraphLock: toggleGraphLock
  });
  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => findEdgeInspectorModel(graph, selectedEdgeId),
    [graph, selectedEdgeId]
  );
  const canvasSelection = useMemo(
    () => ({
      edgeIds: selectedEdgeIds,
      nodeIds: selectedNodeIds
    }),
    [selectedEdgeIds, selectedNodeIds]
  );
  const selectedRuntimeControlValue = selectedNode
    ? runtimeControlValuesForSession[selectedNode.id]
    : undefined;
  const liveControlQueueRef = useRef<{
    inFlight: boolean;
    latestSequence: number;
    nextSequence: number;
    request: { request: RuntimeControlEventRequest; sequence: number } | null;
  }>({ inFlight: false, latestSequence: 0, nextSequence: 0, request: null });
  const runtimeLiveStateRef = useRef({
    info: runtimeInfo,
    sessionLoaded: runtimeSessionLoaded(runtimeSession),
    sessionSynced: runtimeSessionSynced,
    status: runtimeStatus,
    sessionId: runtimeSessionId,
    url: runtimeUrl
  });

  useEffect(() => {
    runtimeLiveStateRef.current = {
      info: runtimeInfo,
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced,
      status: runtimeStatus,
      sessionId: runtimeSessionId,
      url: runtimeUrl
    };
  }, [runtimeInfo, runtimeSession?.snapshot.project, runtimeSessionId, runtimeSessionSynced, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    const scope = createRuntimeScope({
      profileId: runtimeProfileState.activeProfileId,
      runtimeUrl,
      sessionId: runtimeSessionId,
      windowId: studioWindowId,
      windowMode: currentWindowMode
    });
    setWindowRegistry((current) => updateWindowRuntimeScope(current, studioWindowId, scope));
  }, [currentWindowMode, runtimeProfileState.activeProfileId, runtimeSessionId, runtimeUrl, studioWindowId]);

  useEffect(() => {
    const appendClientError = (message: string) => {
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(`browser-${timestamp}-${current.length}`, "error", message, timestamp)
        ].slice(-200)
      );
    };
    const handleError = (event: ErrorEvent) => {
      appendClientError(event.message || "Browser client error.");
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      appendClientError(reason instanceof Error ? reason.message : String(reason ?? "Unhandled promise rejection."));
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleError);
    window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsLogStream(runtimeInfo)) {
      setRuntimeStreamLogLines([]);
      return undefined;
    }

    let reportedStreamError = false;
    const source = new EventSource(runtimeLogStreamUrl(runtimeUrl));
    const handleRuntimeLog = (event: MessageEvent) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isRuntimeLogEvent(value)) {
        return;
      }
      const line = runtimeLogLineFromEvent(value);
      setRuntimeStreamLogLines((current) => upsertBoundedLogLine(current, line));
    };
    const handleLogGap = () => {
      const timestamp = new Date().toISOString();
      setRuntimeStreamLogLines((current) =>
        upsertBoundedLogLine(current, {
          id: `runtime:stream-gap-${timestamp}`,
          level: "warning",
          message: "runtime log stream receiver lagged; some events may be missing",
          source: "runtime",
          timestamp
        })
      );
    };
    const handleStreamError = () => {
      if (reportedStreamError) {
        return;
      }
      reportedStreamError = true;
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-log-stream-${timestamp}-${current.length}`,
            "warning",
            "Runtime log stream disconnected.",
            timestamp
          )
        ].slice(-200)
      );
    };

    source.addEventListener("log", handleRuntimeLog);
    source.addEventListener("log-gap", handleLogGap);
    source.addEventListener("error", handleStreamError);

    return () => {
      source.removeEventListener("log", handleRuntimeLog);
      source.removeEventListener("log-gap", handleLogGap);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [runtimeInfo, runtimeSessionId, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsSessionEvents(runtimeInfo)) {
      return undefined;
    }

    let reportedStreamError = false;
    const source = new EventSource(runtimeSessionEventsStreamUrl(runtimeUrl, runtimeSessionId));
    const handleSessionEvent = (event: MessageEvent) => {
      let value: unknown;
      try {
        value = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isRuntimeSessionEvent(value)) {
        return;
      }

      const eventSession = runtimeSessionFromEvent(value);
      setRuntimeSession(eventSession);
      setRuntimeHistory(value.history);
      setRuntimeStatus("connected");
      const project = value.snapshot.project;
      if (project) {
        acceptRuntimeProject(project);
        setLastLoadedGraphFingerprint(runtimeSessionFingerprint(eventSession));
        if (runtimeSupportsControlState(runtimeInfo)) {
          void refreshRuntimeControlState(createActiveRuntimeClient(), runtimeInfo);
        }
        return;
      }
      setRuntimeControlState(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
    };
    const handleSessionGap = () => {
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-session-gap-${timestamp}-${current.length}`,
            "warning",
            "Runtime session stream receiver lagged; refreshing session.",
            timestamp
          )
        ].slice(-200)
      );
      void refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
    };
    const handleStreamError = () => {
      if (reportedStreamError) {
        return;
      }
      reportedStreamError = true;
      const timestamp = new Date().toISOString();
      setClientLogLines((current) =>
        [
          ...current,
          clientLogLine(
            `runtime-session-stream-${timestamp}-${current.length}`,
            "warning",
            "Runtime session stream disconnected.",
            timestamp
          )
        ].slice(-200)
      );
    };

    source.addEventListener("session", handleSessionEvent);
    source.addEventListener("session-gap", handleSessionGap);
    source.addEventListener("error", handleStreamError);

    return () => {
      source.removeEventListener("session", handleSessionEvent);
      source.removeEventListener("session-gap", handleSessionGap);
      source.removeEventListener("error", handleStreamError);
      source.close();
    };
  }, [runtimeInfo, runtimeSessionId, runtimeStatus, runtimeUrl]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = runtimeHistoryShortcutAction(event);
      if (!action) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const availability = runtimeHistoryActionAvailability({
        connected: runtimeStatus === "connected",
        graphLocked,
        sessionLoaded: runtimeSessionLoaded(runtimeSession),
        sessionSynced: runtimeSessionSynced,
        pendingPatchOps: 0,
        history: runtimeHistory
      });
      if (runtimeBusyAction || (action === "undo" ? !availability.canUndo : !availability.canRedo)) {
        return;
      }

      void runRuntimeHistoryShortcut(action);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    graphLocked,
    runtimeBusyAction,
    runtimeHistory,
    runtimeInfo,
    runtimeSession?.snapshot.project,
    runtimeSessionSynced,
    runtimeStatus,
    runtimeUrl
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const selectedText = window.getSelection()?.toString() ?? "";
      const action = graphClipboardShortcutAction(event, { selectedText });
      if (!action) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (action === "copy") {
        void copySelectedGraphFragment();
        return;
      }
      void pasteGraphFragmentFromClipboard();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    graph,
    graphFragmentClipboard,
    runtimeInfo,
    runtimeSession?.snapshot.project,
    runtimeSessionSynced,
    runtimeStatus,
    runtimeUrl,
    selectedEdgeIds,
    selectedNodeIds,
    viewState
  ]);

  const appendClientLog = useCallback((level: LogLevel, message: string) => {
    const timestamp = new Date().toISOString();
    setClientLogLines((current) =>
      [
        ...current,
        clientLogLine(`studio-${timestamp}-${current.length}`, level, message, timestamp)
      ].slice(-200)
    );
  }, []);

  const handleConnectionCheck = useCallback((check: ConnectionCheck | null) => {
    if (check && !check.ok) {
      appendClientLog("error", check.message);
    }
  }, [appendClientLog]);

  useEffect(() => {
    if (validation.ok) {
      validationErrorLogFingerprintRef.current = null;
      return;
    }

    const fingerprint = validation.errors.join("\n");
    if (validationErrorLogFingerprintRef.current === fingerprint) {
      return;
    }
    validationErrorLogFingerprintRef.current = fingerprint;
    appendClientLog("error", `Invalid Runtime graph shape: ${validation.errors.slice(0, 3).join("; ")}`);
  }, [appendClientLog, validation]);

  useEffect(() => {
    const visibleIssues = semanticIssues.filter((issue) => issue.severity === "error" || issue.severity === "warning");
    if (visibleIssues.length === 0) {
      semanticIssueLogFingerprintRef.current = null;
      return;
    }

    const fingerprint = visibleIssues
      .map((issue) => `${issue.severity}:${issue.code}:${issue.message}`)
      .join("\n");
    if (semanticIssueLogFingerprintRef.current === fingerprint) {
      return;
    }
    semanticIssueLogFingerprintRef.current = fingerprint;
    for (const issue of visibleIssues.slice(0, 5)) {
      appendClientLog(issue.severity === "error" ? "error" : "warning", `${issue.code}: ${issue.message}`);
    }
  }, [appendClientLog, semanticIssues]);

  function createActiveRuntimeClient(baseUrl = runtimeUrl): RuntimeClient {
    return createRuntimeClient({ baseUrl, sessionId: runtimeSessionId });
  }

  function createActiveRuntimeGraphCommandClient(baseUrl = runtimeUrl): RuntimeGraphCommandClient {
    return createRuntimeGraphCommandClient({
      baseUrl,
      sessionId: runtimeSessionId,
      windowId: studioWindowId
    });
  }

  function currentRuntimeGraphRevision(): string | null {
    return runtimeSession?.snapshot.project?.graph.revision ?? null;
  }

  function resetRuntimeConnectionState() {
    setRuntimeStatus("disconnected");
    setRuntimeInfo(null);
    setNodeCatalog(null);
    setRuntimeSession(null);
    setRuntimeControlState(null);
    setRuntimeHistory(null);
    setRuntimePreviewStatus(null);
    setRuntimeTelemetry(null);
    setGeneratedShader(null);
    setLastLoadedGraphFingerprint(null);
    clearPendingPatch();
    setRuntimeError(null);
  }

  function rememberRuntimeConnectionPreference(options: { autoConnect: boolean; state?: typeof runtimeProfileState }) {
    const state = options.state ?? runtimeProfileState;
    writeCachedRuntimeConnectionPreference({
      activeProfileId: state.activeProfileId,
      autoConnect: options.autoConnect,
      remoteRuntimeUrl: state.profiles.remote.url,
      sessionId: runtimeSessionId
    });
  }

  function setViewState(update: ViewStateV01 | ((currentViewState: ViewStateV01) => ViewStateV01)) {
    setActiveProject((currentProject) => {
      const nextViewState = typeof update === "function" ? update(currentProject.viewState) : update;
      return updateProjectViewState(currentProject, nextViewState);
    });
  }

  async function copySelectedGraphFragment() {
    const result = createGraphFragmentFromSelection(graph, viewState, {
      edgeIds: selectedEdgeIds,
      nodeIds: selectedNodeIds
    }, {
      id: `fragment_${Date.now()}`,
      source: "root"
    });
    if (!result.fragment) {
      const message = result.issues[0]?.message ?? "No graph fragment could be copied.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    recordCopiedGraphFragment(result.fragment, result, "root graph");
    await writeGraphFragmentToSystemClipboard(result.fragment);
  }

  function recordCopiedGraphFragment(
    fragment: GraphFragmentV01,
    result: GraphFragmentBuildResult,
    sourceLabel: string
  ) {
    setGraphFragmentClipboard(fragment);
    if (result.omittedEdges.length > 0) {
      appendClientLog("warning", `Copied fragment omitted ${result.omittedEdges.length} selected external cable(s).`);
    }
    appendClientLog("info", `Copied ${sourceLabel} fragment with ${fragment.nodes.length} node(s).`);
  }

  async function writeGraphFragmentToSystemClipboard(fragment: GraphFragmentV01) {
    if (!navigator.clipboard?.writeText) {
      appendClientLog("warning", "Browser clipboard is unavailable; Studio kept the fragment in memory.");
      return;
    }
    try {
      await navigator.clipboard.writeText(serializeGraphFragmentClipboard(fragment));
    } catch {
      appendClientLog("warning", "Browser clipboard write failed; Studio kept the fragment in memory.");
    }
  }

  async function pasteGraphFragmentFromClipboard(fragmentOverride?: GraphFragmentV01) {
    let fragment = fragmentOverride ?? graphFragmentClipboard;
    if (!fragmentOverride) {
      try {
        const clipboardText = await navigator.clipboard?.readText();
        const parsed = clipboardText ? parseGraphFragmentClipboard(clipboardText) : null;
        fragment = parsed ?? fragment;
      } catch {
        appendClientLog("warning", "Browser clipboard read failed; Studio used the in-memory graph fragment.");
      }
    }
    if (!fragment) {
      const message = "Copy a graph fragment before pasting.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    await pasteGraphFragmentToRuntime(fragment);
  }

  async function pasteGraphFragmentToRuntime(fragment: GraphFragmentV01) {
    const availability = graphFragmentPasteAvailability({
      capabilities: runtimeInfo?.capabilities,
      connected: runtimeStatus === "connected",
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced
    });
    if (!availability.ok) {
      setRuntimeError(availability.reason);
      appendClientLog("warning", availability.reason);
      return;
    }

    const baseRevision = runtimeSession?.snapshot.project?.graph.revision ?? null;
    if (!baseRevision) {
      const message = "Runtime session graph revision is required before pasting graph fragments.";
      setRuntimeError(message);
      appendClientLog("warning", message);
      return;
    }

    const request = createPasteGraphFragmentRequest(fragment, baseRevision);
    setRuntimeBusyAction("graphCommand");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createActiveRuntimeClient();
      const { response } = await sendRuntimeGraphCommandAndRefresh({
        graphCommandClient: createActiveRuntimeGraphCommandClient(),
        payload: {
          kind: "graph.pasteFragment",
          request
        },
        refreshRuntimeProject: refreshRuntimeProjectFromRuntime,
        runtimeClient: client
      });
      const message = runtimeGraphCommandRejectionMessage(response, "Runtime rejected graph fragment paste.");
      if (message) {
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
      }
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime graph fragment paste failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original paste error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function toggleGraphLock() {
    setGraphLocked((locked) => !locked);
  }

  function updateGraphPointerPosition(position: GraphPointerPosition | null) {
    graphPointerPositionRef.current = position;
    if (position) {
      lastGraphPointerPositionRef.current = position;
    }
  }

  function createShortcutObjectAtPosition(request: {
    beginEditingObjectSpec: boolean;
    objectSpec?: string;
    position: GraphPointerPosition;
  }) {
    void createRuntimeObjectNode(request.objectSpec, {
      beginEditingObjectSpec: request.beginEditingObjectSpec,
      position: request.position
    });
  }

  function addObjectAtPosition(position: { x: number; y: number }) {
    createShortcutObjectAtPosition({
      beginEditingObjectSpec: true,
      position
    });
  }

  async function addObjectNode(): Promise<boolean> {
    const nodeId = await createRuntimeObjectNode(undefined, {
      beginEditingObjectSpec: true,
      position: lastGraphPointerPositionRef.current ?? defaultObjectNodePosition(graph.nodes.length)
    });
    return nodeId !== null;
  }

  async function addObjectNodeFromSpec(objectSpec: string): Promise<boolean> {
    const nodeId = await createRuntimeObjectNode(objectSpec, {
      position: lastGraphPointerPositionRef.current ?? defaultObjectNodePosition(graph.nodes.length)
    });
    return nodeId !== null;
  }

  async function createRuntimeObjectNode(
    objectSpec: string | undefined,
    options: {
      beginEditingObjectSpec?: boolean;
      params?: Record<string, unknown>;
      position: { x: number; y: number };
    }
  ): Promise<string | null> {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before adding or moving objects.");
      return null;
    }
    const trimmedObjectSpec = objectSpec?.trim() ?? "";
    const baseRevision = currentRuntimeGraphRevision();
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || !baseRevision) {
      setRuntimeError("Runtime session is required before creating objects.");
      return null;
    }

    setRuntimeBusyAction("graphCommand");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const { response } = await sendRuntimeGraphCommandAndRefresh({
        graphCommandClient: createActiveRuntimeGraphCommandClient(),
        payload: {
          kind: "node.create",
          target: rootGraphTarget(baseRevision),
          baseGraphRevision: baseRevision,
          ...(trimmedObjectSpec ? { objectSpec: trimmedObjectSpec } : {}),
          view: options.position,
          ...(options.params && Object.keys(options.params).length > 0 ? { params: options.params } : {}),
          ...(trimmedObjectSpec ? { unresolvedPolicy: "materialize-issue" as const } : {})
        },
        refreshRuntimeProject: refreshRuntimeProjectFromRuntime,
        runtimeClient: createActiveRuntimeClient()
      });
      const nodeId = graphCommandNodeId(response);
      const message = runtimeGraphCommandRejectionMessage(response, "Runtime rejected object create.");
      if (message) {
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
        return null;
      }
      selectSingleNode(nodeId);
      if (options.beginEditingObjectSpec) {
        setEditingObjectSpecNodeId(nodeId);
      } else {
        openInspectSidePanel();
      }
      handleConnectionCheck(null);
      return nodeId;
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime object create failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original create error visible.
      }
      return null;
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function replaceObjectNodeSpec(nodeId: string, objectSpec: string) {
    if (graphLocked) {
      setRuntimeError("Unlock the graph before editing objects.");
      return;
    }
    const existing = graph.nodes.find((node) => node.id === nodeId);
    if (!existing) {
      setRuntimeError(`${nodeId} no longer exists.`);
      return;
    }
    const trimmedObjectSpec = objectSpec.trim();
    const baseRevision = currentRuntimeGraphRevision();
    if (!trimmedObjectSpec) {
      setRuntimeError("Enter an object spec before editing an object.");
      return;
    }
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || !baseRevision) {
      setRuntimeError("Runtime session is required before editing objects.");
      return;
    }
    const existingView = viewState.canvas.nodes[nodeId];

    setRuntimeBusyAction("graphCommand");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const { response } = await sendRuntimeGraphCommandAndRefresh({
        graphCommandClient: createActiveRuntimeGraphCommandClient(),
        payload: {
          kind: "node.replace",
          target: rootGraphTarget(baseRevision),
          baseGraphRevision: baseRevision,
          nodeId,
          objectSpec: trimmedObjectSpec,
          ...(existingView ? { view: existingView } : {}),
          unresolvedPolicy: "materialize-issue",
          interfaceIncidentEdgePolicy: "drop"
        },
        refreshRuntimeProject: refreshRuntimeProjectFromRuntime,
        runtimeClient: createActiveRuntimeClient()
      });
      const message = runtimeGraphCommandRejectionMessage(response, "Runtime rejected object edit.");
      if (message) {
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
        return;
      }
      selectSingleNode(nodeId);
      openInspectSidePanel();
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime object edit failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original edit error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function updateGraph(nextGraph: DisplayGraphDocumentV01, patches: GraphPatch[] = []) {
    if (patches.length === 0) {
      const nextProject = updateActiveProjectGraph(activeProject, nextGraph, patches);
      setActiveProject(nextProject);
      handleConnectionCheck(null);
      return;
    }

    void applyRuntimeGraphPatches(patches);
    handleConnectionCheck(null);
  }

  async function applyRuntimeGraphPatches(patches: GraphPatch[]) {
    if (runtimeStatus !== "connected" || !runtimeSessionSynced) {
      setRuntimeError("Runtime session is required before graph edits can be applied.");
      return;
    }
    let baseRevision = currentRuntimeGraphRevision();
    if (!baseRevision) {
      setRuntimeError("Runtime graph revision is required before graph edits can be applied.");
      return;
    }

    const commandGroups = runtimeCommandGroupsFromGraphPatches(patches);
    if (!commandGroups) {
      setRuntimeError("Runtime does not support this graph edit as a live command yet.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original live-command error visible.
      }
      return;
    }

    setRuntimeBusyAction("graphCommand");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const graphCommandClient = createActiveRuntimeGraphCommandClient();
      let baseSessionRevision = runtimeSession?.snapshot.sessionRevision;
      for (const group of commandGroups) {
        const response = await graphCommandClient.sendGraphCommand(
          runtimeGraphCommandPayloadForPatchGroup(group, baseRevision, baseSessionRevision)
        );
        const message = runtimeGraphCommandRejectionMessage(response, "Runtime rejected graph edit.");
        if (message) {
          setRuntimeError(message);
          appendClientLog(response.conflict ? "warning" : "error", message);
          await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
          return;
        }
        if (typeof response.payload.sessionRevision === "number") {
          baseSessionRevision = response.payload.sessionRevision;
        }
        if (response.payload.graphRevision) {
          baseRevision = response.payload.graphRevision;
        }
      }

      await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime graph edit failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original graph edit error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function updateViewStateFromCanvas(nextViewState: ViewStateV01) {
    setViewState(nextViewState);
    if (!nodeViewStateChanged(viewState, nextViewState)) {
      return;
    }
    void applyRuntimeViewStatePatch(nextViewState);
  }

  function updateViewportFromCanvas(nextViewport: CanvasViewport) {
    writeCachedViewport(viewportCacheKeyForProject(activeProject, viewportCacheSurface), nextViewport);
    setWindowRegistry((current) => {
      const currentViewport = current.windows[studioWindowId]?.localState.viewport ?? null;
      if (canvasViewportEquals(currentViewport, nextViewport)) {
        return current;
      }
      return updateWindowLocalState(current, studioWindowId, {
        viewport: nextViewport
      });
    });
  }

  async function applyRuntimeViewStatePatch(nextViewState: ViewStateV01) {
    const baseViewRevision = runtimeSession?.snapshot.viewRevision ?? null;
    if (runtimeStatus !== "connected" || !runtimeSessionSynced || baseViewRevision === null) {
      setRuntimeError("Runtime session is required before object positions can be applied.");
      return;
    }
    const ops = changedNodeViewOperations(graph, viewState, nextViewState);
    if (ops.length === 0) {
      return;
    }

    const baseGraphRevision = currentRuntimeGraphRevision();
    setRuntimeBusyAction("graphCommand");
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createActiveRuntimeClient();
      const { response } = await sendRuntimeGraphCommandAndRefresh({
        graphCommandClient: createActiveRuntimeGraphCommandClient(),
        payload: {
          kind: "view.patch",
          baseViewRevision,
          ...(baseGraphRevision ? { baseGraphRevision } : {}),
          viewPatch: {
            baseViewRevision,
            ops
          },
          description: "move object"
        },
        refreshRuntimeProject: refreshRuntimeProjectFromRuntime,
        runtimeClient: client
      });
      setRuntimeStatus("connected");

      if (response.ok && response.applied) {
        clearPendingPatch();
        return;
      }

      if (response.conflict) {
        const message =
          response.issues[0]?.message ?? "Runtime rejected view patch; Studio was restored from Runtime session.";
        setPatchConflict(message);
        setRuntimeError(message);
        await refreshRuntimeProjectFromRuntime(client);
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime view patch failed.");
      try {
        await refreshRuntimeProjectFromRuntime(createActiveRuntimeClient());
      } catch {
        // Keep the original runtime error visible.
      }
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function clearPendingPatch() {
    setPendingPatchBaseRevision(null);
    setPatchConflict(null);
  }

  function acceptRuntimeProject(nextProject: ProjectDocumentV01) {
    const parsedProject = parseProjectDocument(nextProject);
    const nextGraph = activeProjectDisplayGraph(parsedProject);
    const cachedViewport = readCachedViewport(viewportCacheKeyForProject(parsedProject, viewportCacheSurface));
    setWindowRegistry((current) => {
      const currentViewport = current.windows[studioWindowId]?.localState.viewport ?? null;
      if (canvasViewportEquals(currentViewport, cachedViewport)) {
        return current;
      }
      return updateWindowLocalState(current, studioWindowId, {
        viewport: cachedViewport
      });
    });
    setActiveProject(parsedProject);
    const availableNodeIds = new Set(nextGraph.nodes.map((node) => node.id));
    const availableEdgeIds = new Set(nextGraph.edges.map((edge) => displayEdgeToEdgeSpec(edge).id));
    pruneSelection(availableNodeIds, availableEdgeIds);
    handleConnectionCheck(null);
    setLastLoadedGraphFingerprint(runtimeGraphFingerprint(parsedProject.graph.id, parsedProject.graph.revision));
  }

  async function loadProjectIntoRuntime(
    project: ProjectDocumentV01,
    busyAction = "loadSession"
  ) {
    if (runtimeStatus !== "connected") {
      setRuntimeError("Connect Runtime before opening or changing a graph.");
      return;
    }

    setRuntimeBusyAction(busyAction);
    setRuntimeError(null);
    try {
      const client = createActiveRuntimeClient();
      const response = await client.loadSession(createRuntimeSessionLoadRequest(project, { mode: "forceReplace" }));
      const loadedProject = response.snapshot.project;
      if (!response.ok || !loadedProject) {
        throw new RuntimeClientError(response.issues[0]?.message ?? "Runtime rejected project load.");
      }

      setRuntimeSession(response);
      setRuntimeStatus("connected");
      acceptRuntimeProject(loadedProject);
      clearPendingPatch();
      setRuntimeControlState(runtimeSupportsControlState(runtimeInfo) ? await client.getControlState() : null);
      await refreshRuntimeHistory(client);
      await refreshRuntimePreview(client);
      await refreshRuntimeTelemetry(client);
      setGeneratedShader(null);
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime project load failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function fetchRuntimeOwnedProject(
    client: RuntimeClient,
    info: RuntimeInfo,
    session: RuntimeSessionResponse
  ): Promise<RuntimeSessionResponse> {
    if (!session.snapshot.project) {
      const seedProject = createUntitledProject();
      const loaded = await client.loadSession(createRuntimeSessionLoadRequest(seedProject));
      const loadedProject = loaded.snapshot.project;
      if (!loaded.ok || !loadedProject) {
        throw new RuntimeClientError(loaded.issues[0]?.message ?? "Runtime rejected initial project load.");
      }
      acceptRuntimeProject(loadedProject);
      return loaded;
    }

    acceptRuntimeProject(session.snapshot.project);
    return session;
  }

  async function importGraph(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const project = parseGraphDocumentAsActiveProject(parsed);
      await loadProjectIntoRuntime(project);
      selectSingleNode(project.graph.nodes[0]?.id ?? null);
      setImportError(null);
      handleConnectionCheck(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Graph import failed.");
    }
  }

  async function openProject(file: File | null) {
    if (!file) {
      return;
    }

    try {
      const project = parseProjectDocument(JSON.parse(await file.text()) as unknown);
      await loadProjectIntoRuntime(project);
      selectSingleNode(project.graph.nodes[0]?.id ?? null);
      setImportError(null);
      handleConnectionCheck(null);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Project open failed.");
    }
  }

  function exportGraph() {
    downloadJson(activeProject.graph, `${activeProject.graph.id || "skenion-graph"}.json`);
  }

  function saveProject() {
    downloadJson(activeProject, `${activeProject.id || "skenion-project"}.skenion.json`);
  }

  function removeNode(node: DisplayGraphNodeV01) {
    const patch = { type: "removeNode", nodeId: node.id } satisfies GraphPatch;
    updateGraph(applyPatch(graph, patch), [patch]);
    selectSingleNode(null);
  }

  function setNodeParam(nodeId: string, key: string, value: unknown) {
    const patch = { type: "setNodeParam", nodeId, key, value } satisfies GraphPatch;
    updateGraph(applyPatch(graph, patch), [patch]);
    handleConnectionCheck(null);
    if (key === "source") {
      setGeneratedShader(null);
    }
  }

  function setNodeParams(nodeId: string, params: Record<string, unknown>) {
    const patches = Object.entries(params).map(([key, value]) => ({
      type: "setNodeParam",
      nodeId,
      key,
      value
    }) satisfies GraphPatch);
    const nextGraph = patches.reduce((currentGraph, patch) => applyPatch(currentGraph, patch), graph);
    updateGraph(nextGraph, patches);
  }

  function syncShaderInputs(nodeId: string, source: string) {
    const patch = createReplaceShaderInterfacePatch(nodeId, source);
    if (!patch) {
      handleConnectionCheck({
        ok: false,
        message: "Shader interface analysis failed. Fix annotation issues before syncing inputs."
      });
      return;
    }

    updateGraph(applyPatch(graph, patch), [patch]);
    handleConnectionCheck(null);
    setGeneratedShader(null);
  }

  async function connectRuntime() {
    setRuntimeBusyAction("connect");
    setRuntimeStatus("connecting");
    setRuntimeError(null);
    try {
      let nextProfileState = runtimeProfileState;
      const connectPlan = planRuntimeConnect(nextProfileState, {
        isolated: currentWindowMode === "isolated-runtime",
        ownerWindowId: studioWindowId
      });
      nextProfileState = connectPlan.state;
      setRuntimeProfileState(nextProfileState);

      const startEffect = connectPlan.effects.find(
        (effect): effect is Extract<RuntimeProfileEffect, { type: "startManagedSidecar" }> =>
          effect.type === "startManagedSidecar"
      );
      let connectUrl = connectPlan.connectUrl ?? runtimeUrl;
      if (startEffect) {
        if (!desktopBridge.available) {
          const message = "Local Runtime requires the desktop shell. Choose Remote for an existing Runtime URL.";
          setRuntimeProfileState(applyRuntimeSidecarError(nextProfileState, [message]));
          throw new RuntimeClientError(message);
        }
        try {
          const startup = await desktopBridge.startManagedSidecar({
            isolated: startEffect.isolated,
            ownerWindowId: startEffect.ownerWindowId,
            profileId: startEffect.profileId
          });
          nextProfileState = applyRuntimeSidecarStarted(nextProfileState, startEffect, startup);
          setRuntimeProfileState(nextProfileState);
          connectUrl = startup.endpoint.url;
          setRuntimeUrl(connectUrl);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Runtime sidecar startup failed.";
          setRuntimeProfileState(applyRuntimeSidecarError(nextProfileState, [message]));
          throw new RuntimeClientError(message);
        }
      }

      const client = createRuntimeClient({ baseUrl: connectUrl, sessionId: runtimeSessionId });
      const health = await client.getHealth();
      if (!health.ok) {
        throw new RuntimeClientError("Runtime health check returned not-ok.");
      }
      const info = await client.getRuntimeInfo();
      const initialSession = await client.getSession();
      const session = await fetchRuntimeOwnedProject(client, info, initialSession);
      const history = runtimeSupportsHistory(info) ? await client.getSessionHistory() : null;
      const previewStatus = runtimeSupportsPreview(info) ? await client.getPreviewStatus() : null;
      const telemetry = runtimeSupportsTelemetry(info) ? await client.getTelemetry() : null;
      const catalog = await fetchRuntimeNodeCatalog(client, info);
      const controlState =
        runtimeSessionLoaded(session) && runtimeSupportsControlState(info) ? await client.getControlState() : null;
      setRuntimeInfo(info);
      setNodeCatalog(catalog);
      setRuntimeSession(session);
      setRuntimeControlState(controlState);
      setRuntimeHistory(history);
      setRuntimePreviewStatus(previewStatus);
      setRuntimeTelemetry(telemetry);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(runtimeSessionFingerprint(session));
      clearPendingPatch();
      setRuntimeStatus("connected");
      rememberRuntimeConnectionPreference({ autoConnect: true, state: nextProfileState });
    } catch (error) {
      setRuntimeInfo(null);
      setNodeCatalog(null);
      setRuntimeSession(null);
      setRuntimeControlState(null);
      setRuntimeHistory(null);
      setRuntimePreviewStatus(null);
      setRuntimeTelemetry(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime connection failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  function changeRuntimeUrl(nextUrl: string) {
    const nextProfileState = updateRuntimeProfileUrl(runtimeProfileState, runtimeProfileState.activeProfileId, nextUrl);
    setRuntimeUrl(nextUrl);
    setRuntimeProfileState(nextProfileState);
    rememberRuntimeConnectionPreference({ autoConnect: false, state: nextProfileState });
    resetRuntimeConnectionState();
  }

  function changeRuntimeProfile(profileId: RuntimeProfileId) {
    const transition = switchRuntimeProfile(runtimeProfileState, profileId);
    setRuntimeProfileState(transition.state);
    setRuntimeUrl(activeRuntimeProfile(transition.state).url);
    rememberRuntimeConnectionPreference({ autoConnect: false, state: transition.state });
    resetRuntimeConnectionState();
    for (const effect of transition.effects) {
      if (effect.type === "stopManagedSidecar") {
        void stopManagedSidecarForEffect(effect);
      }
    }
  }

  connectRuntimeRef.current = connectRuntime;

  useEffect(() => {
    if (
      autoConnectAttemptedRef.current ||
      !autoConnectRuntimeOnMount ||
      runtimeStatus !== "disconnected"
    ) {
      return;
    }

    autoConnectAttemptedRef.current = true;
    void connectRuntimeRef.current();
  }, [autoConnectRuntimeOnMount, runtimeStatus]);

  async function stopManagedSidecarForEffect(
    effect: Extract<RuntimeProfileEffect, { type: "stopManagedSidecar" }>
  ) {
    if (!desktopBridge.available) {
      setRuntimeProfileState((current) => applyRuntimeSidecarStopped(current));
      return;
    }
    try {
      const response = await desktopBridge.stopManagedSidecar({
        ownerWindowId: studioWindowId,
        profileId: effect.profileId,
        reason: effect.reason
      });
      setRuntimeProfileState((current) => applyRuntimeSidecarStopped(current));
      if (response.stopped) {
        appendClientLog("info", `Stopped managed Runtime sidecar ${response.runtimeUrl ?? effect.profileId}.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime sidecar shutdown failed.";
      setRuntimeProfileState((current) => applyRuntimeSidecarError(current, [message]));
      appendClientLog("warning", message);
    }
  }

  async function openDesktopRuntimeWindow(windowMode: Extract<StudioWindowMode, "shared-session" | "isolated-runtime">) {
    if (!desktopBridge.available) {
      appendClientLog("warning", "Desktop window actions require the Tauri shell.");
      return;
    }
    const windowId = createStudioWindowId(windowMode === "isolated-runtime" ? "studio-isolated" : "studio");
    const profileId = windowMode === "isolated-runtime" ? "local" : runtimeProfileState.activeProfileId;
    try {
      await desktopBridge.openStudioWindow({
        profileId,
        runtimeUrl,
        sessionId: runtimeSessionId,
        windowId,
        windowMode
      });
      setWindowRegistry((current) =>
        registerRuntimeWindow(current, {
          scope: createRuntimeScope({
            profileId,
            runtimeUrl,
            sessionId: runtimeSessionId,
            windowId,
            windowMode
          }),
          windowId
        })
      );
      appendClientLog(
        "info",
        `Opened ${windowMode === "isolated-runtime" ? "separate Runtime" : "new"} Studio window ${windowId}.`
      );
    } catch (error) {
      appendClientLog("warning", error instanceof Error ? error.message : "Desktop window open failed.");
    }
  }

  async function refreshRuntimeProjectFromRuntime(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    const session = await client.getSession();
    const project = session.snapshot.project;
    if (!info || !project) {
      setRuntimeSession(session);
      setNodeCatalog(null);
      setRuntimeControlState(null);
      setRuntimeHistory(null);
      setRuntimePreviewStatus(null);
      setRuntimeTelemetry(null);
      setGeneratedShader(null);
      setLastLoadedGraphFingerprint(null);
      clearPendingPatch();
      return session;
    }

    acceptRuntimeProject(project);
    setRuntimeSession(session);
    setNodeCatalog(await fetchRuntimeNodeCatalog(client, info));
    setRuntimeControlState(runtimeSupportsControlState(info) ? await client.getControlState() : null);
    await refreshRuntimeHistory(client, info);
    await refreshRuntimePreview(client);
    await refreshRuntimeTelemetry(client);
    clearPendingPatch();
    return session;
  }

  async function refreshRuntimeHistory(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsHistory(info)) {
      setRuntimeHistory(null);
      return null;
    }

    const history = await client.getSessionHistory();
    setRuntimeHistory(history);
    return history;
  }

  async function refreshRuntimePreview(client: RuntimeClient = createActiveRuntimeClient()) {
    if (!runtimeSupportsPreview(runtimeInfo)) {
      setRuntimePreviewStatus(null);
      return null;
    }

    const previewStatus = await client.getPreviewStatus();
    setRuntimePreviewStatus(previewStatus);
    return previewStatus;
  }

  async function refreshRuntimeControlState(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsControlState(info)) {
      setRuntimeControlState(null);
      return null;
    }

    const controlState = await client.getControlState();
    setRuntimeControlState(controlState);
    return controlState;
  }

  async function fetchRuntimeNodeCatalog(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ): Promise<NodeCatalogSnapshotV01 | null> {
    if (!runtimeSupportsNodeCatalog(info)) {
      return null;
    }
    try {
      return await client.getNodeCatalog();
    } catch (error) {
      appendClientLog("warning", error instanceof Error ? error.message : "Runtime node catalog request failed.");
      return null;
    }
  }

  async function restoreRuntimeControlStateAfterControlFailure(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    try {
      await refreshRuntimeControlState(client, info);
    } catch {
      setRuntimeControlState(null);
    }
  }

  async function refreshRuntimeTelemetry(
    client: RuntimeClient = createActiveRuntimeClient(),
    info: RuntimeInfo | null = runtimeInfo
  ) {
    if (!runtimeSupportsTelemetry(info)) {
      setRuntimeTelemetry(null);
      return null;
    }

    const telemetry = await client.getTelemetry();
    setRuntimeTelemetry(telemetry);
    return telemetry;
  }

  async function loadGeneratedShader() {
    if (runtimeStatus !== "connected" || !runtimeSupportsGeneratedShader(runtimeInfo)) {
      return;
    }

    setRuntimeBusyAction("generatedShader");
    setRuntimeError(null);
    try {
      const response = await createActiveRuntimeClient().getGeneratedShader();
      setGeneratedShader(response);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime generated shader request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function importRuntimeAsset(node: DisplayGraphNodeV01, file: File) {
    if (runtimeStatus !== "connected" || !runtimeSupportsAssetImport(runtimeInfo)) {
      setRuntimeError("Runtime asset import is not available.");
      return;
    }

    setRuntimeBusyAction("assetImport");
    setRuntimeError(null);
    try {
      const response = await createActiveRuntimeClient().importAsset(file, "video");
      if (!response.ok || !response.asset) {
        throw new RuntimeClientError(response.issues[0]?.message ?? "Runtime asset import failed.");
      }
      const localMetadata = await readLocalVideoAssetMetadata(file).catch(() => ({}));
      setNodeParams(node.id, {
        assetRef: response.asset.runtimeUri,
        name: response.asset.name,
        mimeType: response.asset.mimeType,
        ...localMetadata
      });
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime asset import failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimePreviewFromPanel() {
    setRuntimeBusyAction("previewStatus");
    setRuntimeError(null);
    try {
      await refreshRuntimePreview();
      await refreshRuntimeTelemetry();
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function refreshRuntimeSessionFromPanel() {
    setRuntimeBusyAction("session");
    setRuntimeError(null);
    try {
      const client = createActiveRuntimeClient();
      await refreshRuntimeProjectFromRuntime(client);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime session refresh failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimePreviewAction(
    kind: "startPreview" | "stopPreview" | "restartPreview",
    action: () => Promise<RuntimePreviewStatus>
  ) {
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    try {
      const response = await action();
      const client = createActiveRuntimeClient();
      setRuntimePreviewStatus(response);
      await refreshRuntimeTelemetry(client);
      setRuntimeStatus("connected");
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function runRuntimeHistoryShortcut(action: RuntimeHistoryShortcutAction) {
    if (runtimeBusyAction) {
      return;
    }

    const availability = runtimeHistoryActionAvailability({
      connected: runtimeStatus === "connected",
      graphLocked,
      sessionLoaded: runtimeSessionLoaded(runtimeSession),
      sessionSynced: runtimeSessionSynced,
      pendingPatchOps: 0,
      history: runtimeHistory
    });
    if (action === "undo" ? !availability.canUndo : !availability.canRedo) {
      return;
    }

    const kind = action === "undo" ? "historyUndo" : "historyRedo";
    setRuntimeBusyAction(kind);
    setRuntimeError(null);
    setPatchConflict(null);
    try {
      const client = createActiveRuntimeClient();
      const response = await createActiveRuntimeGraphCommandClient().sendGraphCommand({
        kind: action === "undo" ? "history.undo" : "history.redo",
        scope: "client"
      });
      await refreshRuntimeProjectFromRuntime(client);
      if (!response.ok || !response.applied) {
        const message = response.issues[0]?.message ?? "Runtime rejected history command.";
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
    } finally {
      setRuntimeBusyAction(null);
    }
  }

  async function sendRuntimeControlEvent(request: RuntimeControlEventRequest) {
    if (!runtimeControlInteractionEnabled) {
      return;
    }

    setRuntimeError(null);
    applyOptimisticRuntimeControlEvent(request);
    const client = createActiveRuntimeClient();
    try {
      const response = await createActiveRuntimeGraphCommandClient().sendGraphCommand({
        kind: "node.input",
        nodeId: request.nodeId,
        portId: request.portId,
        message: request.message
      });
      setRuntimeStatus("connected");
      if (response.ok && response.applied) {
        recordRuntimeControlPulseForRequest(request);
      }
      if (!response.ok || !response.applied) {
        const message = response.issues[0]?.message ?? "Runtime rejected node input.";
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
      }
      if (runtimeSupportsControlState(runtimeInfo)) {
        await refreshRuntimeControlState(client);
      } else {
        await restoreRuntimeControlStateAfterControlFailure(client);
      }
    } catch (error) {
      setRuntimeStatus("error");
      setRuntimeError(error instanceof Error ? error.message : "Runtime request failed.");
      await restoreRuntimeControlStateAfterControlFailure(client);
    }
  }

  function sendRuntimeLiveControlEvent(request: RuntimeControlEventRequest) {
    const queue = liveControlQueueRef.current;
    const sequence = queue.nextSequence + 1;
    queue.nextSequence = sequence;
    queue.latestSequence = sequence;
    applyOptimisticRuntimeControlEvent(request);
    queue.request = { request, sequence };
    void flushRuntimeLiveControlQueue();
  }

  function applyOptimisticRuntimeControlEvent(request: RuntimeControlEventRequest) {
    const atom = request.message.atoms[0];
    if (!atom || (request.portId !== "in" && request.portId !== "cold")) {
      return;
    }
    const shouldPropagate = request.portId === "in" && request.message.selector !== "set";

    setRuntimeControlState((current) => {
      if (!current) {
        return current;
      }
      const values = { ...current.values };
      let changed = setRuntimeControlValueIfChanged(values, request.nodeId, atom);
      if (shouldPropagate) {
        changed = propagateOptimisticValue(request.nodeId, atom, values) || changed;
      }
      return changed ? {
        ...current,
        values
      } : current;
    });
  }

  function propagateOptimisticValue(
    sourceNodeId: string,
    value: RuntimeControlValue,
    values: Record<string, RuntimeControlValue>
  ): boolean {
    const queue = [sourceNodeId];
    const visited = new Set<string>();
    let changed = false;
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (!nodeId || visited.has(nodeId)) {
        continue;
      }
      visited.add(nodeId);
      for (const edge of graph.edges) {
        if (edge.from.node !== nodeId || edge.from.port !== "value" || edge.to.port !== "in") {
          continue;
        }
        const targetNode = graph.nodes.find((node) => node.id === edge.to.node);
        if (!targetNode || !isOptimisticValueTarget(targetNode, value)) {
          continue;
        }
        changed = setRuntimeControlValueIfChanged(values, targetNode.id, value) || changed;
        queue.push(targetNode.id);
      }
    }
    return changed;
  }

  function isOptimisticValueTarget(node: DisplayGraphNodeV01, value: RuntimeControlValue): boolean {
    return (
      (value.type === "float" && node.kind === "core.float") ||
      (value.type === "int" && node.kind === "core.int" && !isUnsignedIntRepresentation(readIntRepresentationParam(node))) ||
      (value.type === "uint" && node.kind === "core.int" && isUnsignedIntRepresentation(readIntRepresentationParam(node))) ||
      (value.type === "bool" && node.kind === "core.bool") ||
      (value.type === "color" && node.kind === "core.color") ||
      (value.type === "string" && node.kind === "core.string")
    );
  }

  async function flushRuntimeLiveControlQueue() {
    const queue = liveControlQueueRef.current;
    if (queue.inFlight) {
      return;
    }

    const pendingRequest = queue.request;
    const { info, sessionId, sessionLoaded, sessionSynced, status, url } = runtimeLiveStateRef.current;
    if (!pendingRequest || status !== "connected" || !sessionLoaded || !sessionSynced || !runtimeSupportsControl(info)) {
      return;
    }

    queue.request = null;
    queue.inFlight = true;
    const { request, sequence } = pendingRequest;
    try {
      const client = createRuntimeClient({ baseUrl: url, sessionId });
      const response = await createRuntimeGraphCommandClient({
        baseUrl: url,
        sessionId,
        windowId: studioWindowId
      }).sendGraphCommand({
        kind: "node.input",
        nodeId: request.nodeId,
        portId: request.portId,
        message: request.message
      });
      const isCurrentLiveResponse = sequence === queue.latestSequence;
      if (isCurrentLiveResponse) {
        setRuntimeStatus("connected");
        setRuntimeError(null);
      }
      if (response.ok && response.applied && isCurrentLiveResponse) {
        recordRuntimeControlPulseForRequest(request);
      }
      if (!response.ok && isCurrentLiveResponse) {
        const message = response.issues[0]?.message ?? "Runtime rejected node input.";
        setRuntimeError(message);
        appendClientLog(response.conflict ? "warning" : "error", message);
      }
      if (isCurrentLiveResponse) {
        await refreshRuntimeControlState(client, info);
      }
    } catch (error) {
      if (sequence === queue.latestSequence) {
        setRuntimeStatus("error");
        setRuntimeError(error instanceof Error ? error.message : "Runtime control event failed.");
        await restoreRuntimeControlStateAfterControlFailure(createRuntimeClient({ baseUrl: url, sessionId }), info);
      }
    } finally {
      queue.inFlight = false;
      if (queue.request) {
        void flushRuntimeLiveControlQueue();
      }
    }
  }

  function recordRuntimeControlPulseForRequest(request: RuntimeControlEventRequest) {
    if (request.message.selector !== "bang") {
      return;
    }
    const pulseKey = runtimeControlPulseCounterRef.current + 1;
    runtimeControlPulseCounterRef.current = pulseKey;
    setRuntimeControlPulses((current) => ({
      ...current,
      [request.nodeId]: pulseKey
    }));
  }

  function setRuntimeControlValueIfChanged(
    values: Record<string, RuntimeControlValue>,
    nodeId: string,
    value: RuntimeControlValue
  ): boolean {
    if (runtimeControlValueEquals(values[nodeId], value)) {
      return false;
    }
    values[nodeId] = value;
    return true;
  }

  function runtimeSupportsSessionEvents(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.events.stream") ?? false;
  }

  function runtimeSupportsPreview(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.preview.status") ?? false;
  }

  function runtimeSupportsTelemetry(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.telemetry") ?? false;
  }

  function runtimeSupportsLogStream(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("runtime.logs.stream") ?? false;
  }

  function runtimeSupportsHistory(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.history") ?? false;
  }

  function runtimeSupportsControl(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.control.nodeInput.realtime.v0.1") ?? false;
  }

  function runtimeSupportsNodeCatalog(info: RuntimeInfo | null): boolean {
    return (
      info?.capabilities.includes("session.nodeCatalog.v0.1") ||
      info?.capabilities.includes("session.nodeCatalog")
    ) ?? false;
  }

  function runtimeSupportsControlState(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.control.state") ?? false;
  }

  function runtimeSupportsGeneratedShader(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("session.render.generatedShader") ?? false;
  }

  function runtimeSupportsAssetImport(info: RuntimeInfo | null): boolean {
    return info?.capabilities.includes("assets.import") ?? false;
  }

  useEffect(() => {
    if (runtimeStatus !== "connected" || !runtimeSupportsTelemetry(runtimeInfo)) {
      return undefined;
    }

    let cancelled = false;
    const client = createActiveRuntimeClient();
    const refresh = async () => {
      try {
        const telemetry = await client.getTelemetry();
        if (!cancelled) {
          setRuntimeTelemetry(telemetry);
        }
      } catch (error) {
        if (!cancelled) {
          setRuntimeTelemetry(null);
          setRuntimeSession(null);
          setRuntimeControlState(null);
          setRuntimeHistory(null);
          setRuntimePreviewStatus(null);
          setGeneratedShader(null);
          setLastLoadedGraphFingerprint(null);
          clearPendingPatch();
          setRuntimeStatus("error");
          setRuntimeError(error instanceof Error ? error.message : "Runtime telemetry request failed.");
        }
      }
    };
    const interval = window.setInterval(() => {
      void refresh();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [runtimeInfo, runtimeStatus, runtimeUrl]);

  const runtimeSettingsPanel = (
    <RuntimeSettingsPanel
      busyAction={runtimeBusyAction}
      desktopAvailable={desktopBridge.available}
      error={runtimeError}
      info={runtimeInfo}
      profileState={runtimeProfileState}
      previewStatus={runtimePreviewStatus}
      session={runtimeSession}
      sessionId={runtimeSessionId}
      sidecarStatus={runtimeProfileState.managedSidecar.status}
      status={runtimeStatus}
      url={runtimeUrl}
      windowCount={currentRuntimeWindowCount}
      windowMode={currentWindowMode}
      onConnect={connectRuntime}
      onOpenNewRuntimeWindow={() => void openDesktopRuntimeWindow("isolated-runtime")}
      onOpenNewWindow={() => void openDesktopRuntimeWindow("shared-session")}
      onProfileChange={changeRuntimeProfile}
      onRefreshSession={refreshRuntimeSessionFromPanel}
      onUrlChange={changeRuntimeUrl}
      onRefreshPreview={refreshRuntimePreviewFromPanel}
      onRestartPreview={() =>
        runRuntimePreviewAction("restartPreview", () =>
          createActiveRuntimeClient().restartPreview()
        )
      }
      onStartPreview={() =>
        runRuntimePreviewAction("startPreview", () =>
          createActiveRuntimeClient().startPreview()
        )
      }
      onStopPreview={() =>
        runRuntimePreviewAction("stopPreview", () =>
          createActiveRuntimeClient().stopPreview()
        )
      }
    />
  );

  const runtimeLogsPanel = (
    <RuntimeLogsPanel
      clientLines={clientLogLines}
      runtimeLines={runtimeStreamLogLines}
    />
  );
  const nodesPanel = runtimeGraphAvailable ? (
    <PalettePanel
      addDisabled={graphLocked}
      catalogEntries={nodeCatalog?.entries ?? []}
      onAddObject={addObjectNode}
      onAddObjectSpec={addObjectNodeFromSpec}
    />
  ) : (
    <RuntimeRequiredPanel status={runtimeStatus} />
  );
  const inspectorPanel = runtimeGraphAvailable ? (
    <InspectorPanel
      generatedShader={generatedShader}
      generatedShaderBusy={runtimeBusyAction === "generatedShader"}
      graphLocked={graphLocked}
      edge={selectedEdge}
      node={selectedNode}
      onImportAsset={importRuntimeAsset}
      onLoadGeneratedShader={runtimeSupportsGeneratedShader(runtimeInfo) ? loadGeneratedShader : undefined}
      onRemoveNode={removeNode}
      onSetNodeParam={setNodeParam}
      onSyncShaderInputs={syncShaderInputs}
      runtimeAssetImportBusy={runtimeBusyAction === "assetImport"}
      runtimeAssetImportEnabled={runtimeStatus === "connected" && runtimeSupportsAssetImport(runtimeInfo)}
      runtimeControlValue={selectedRuntimeControlValue}
    />
  ) : (
    <RuntimeRequiredPanel status={runtimeStatus} />
  );
  const leftPanelItems: PanelRailItem[] = [
    {
      icon: <BoxIcon size={14} />,
      id: "nodes",
      label: panels.nodes.open ? "Hide nodes" : "Show nodes",
      onClick: () => togglePanel("nodes"),
      selected: panels.nodes.open
    }
  ];
  const rightPanelItems: PanelRailItem[] = [
    {
      icon: <PanelRightOpen size={14} />,
      id: "inspector",
      label: panels.inspector.open ? "Hide inspector" : "Inspector",
      onClick: () => togglePanel("inspector"),
      selected: panels.inspector.open
    },
    {
      icon: <ScrollText size={14} />,
      id: "logs",
      label: panels.logs.open ? "Hide logs" : "Logs",
      onClick: () => togglePanel("logs"),
      selected: panels.logs.open
    }
  ];

  return (
    <>
      <AppShell
        header={{ height: 42 }}
        footer={{ height: 30 }}
        navbar={{ width: 30, breakpoint: "sm" }}
        aside={{ width: 30, breakpoint: "md" }}
        padding={0}
      >
        <AppShell.Header>
          <StudioToolbar
            projectName={activeProject.id}
            runtimeGraphAvailable={runtimeGraphAvailable}
            onExport={exportGraph}
            onImport={importGraph}
            onOpenProject={openProject}
            onSaveProject={saveProject}
            onOpenSettings={() => openPanel("settings")}
          />
        </AppShell.Header>

        <AppShell.Footer>
          <IssuesFooter
            graphLockDisabled={!runtimeGraphAvailable}
            graphLocked={graphLocked}
            onToggleGraphLock={toggleGraphLock}
            onOpenIssues={() => openPanel("logs")}
            semanticIssues={semanticIssues}
          />
        </AppShell.Footer>

        <AppShell.Navbar className="workspace-navbar" p={0}>
          <PanelRail edge="left" items={leftPanelItems} />
        </AppShell.Navbar>

        <AppShell.Main>
          <div className="studio-main">
            {importError ? (
              <Alert
                className="studio-alert"
                color="red"
                icon={<CircleAlert size={18} />}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Group gap="xs">
                    <Text fw={700}>Import failed</Text>
                    <Text>{importError}</Text>
                  </Group>
                  <IconButton
                    icon={<X size={14} />}
                    label="Dismiss import error"
                    onClick={() => setImportError(null)}
                    size="sm"
                  />
                </Group>
              </Alert>
            ) : null}
            {runtimeGraphAvailable ? (
              <GraphCanvas
                graph={graph}
                graphLocked={graphLocked}
                editingObjectSpecNodeId={editingObjectSpecNodeId}
                viewState={viewState}
                viewport={canvasViewport}
                onAddObjectAtPosition={addObjectAtPosition}
                onConnectionCheck={handleConnectionCheck}
                onGraphChange={updateGraph}
                onGraphPointerPositionChange={updateGraphPointerPosition}
                onImportAsset={importRuntimeAsset}
                onObjectControl={(nodeId, portId, message) => {
                  void sendRuntimeControlEvent({
                    nodeId,
                    portId: portId as RuntimeControlEventRequest["portId"],
                    message
                  });
                }}
                onObjectLiveControl={(nodeId, portId, message) => {
                  sendRuntimeLiveControlEvent({
                    nodeId,
                    portId: portId as RuntimeControlEventRequest["portId"],
                    message
                  });
                }}
                onObjectParamChange={setNodeParam}
                onObjectSpecCommit={replaceObjectNodeSpec}
                onObjectSpecEditComplete={(nodeId) => {
                  setEditingObjectSpecNodeId((current) => current === nodeId ? null : current);
                }}
                runtimeControlEnabled={runtimeControlInteractionEnabled}
                runtimeControlPulses={runtimeControlPulses}
                runtimeControlValues={runtimeControlValuesForSession}
                onViewStateChange={updateViewStateFromCanvas}
                onViewportChange={updateViewportFromCanvas}
                onSelectionChange={handleCanvasSelectionChange}
                selection={canvasSelection}
              />
            ) : (
              <RuntimeRequiredCanvas status={runtimeStatus} />
            )}
          </div>
        </AppShell.Main>

        <AppShell.Aside className="workspace-aside" p={0}>
          <PanelRail edge="right" items={rightPanelItems} />
        </AppShell.Aside>
      </AppShell>

      {panels.nodes.open ? (
        <FloatingPanel
          onActivate={() => bringPanelToFront("nodes")}
          onClose={() => closePanel("nodes")}
          onMove={(position) => movePanel("nodes", position)}
          onPointerEnter={() => updateGraphPointerPosition(null)}
          onResize={(size) => resizePanel("nodes", size)}
          position={panels.nodes}
          title="Nodes"
        >
          {nodesPanel}
        </FloatingPanel>
      ) : null}

      {panels.inspector.open ? (
        <FloatingPanel
          onActivate={() => bringPanelToFront("inspector")}
          onClose={() => closePanel("inspector")}
          onMove={(position) => movePanel("inspector", position)}
          onPointerEnter={() => updateGraphPointerPosition(null)}
          onResize={(size) => resizePanel("inspector", size)}
          position={panels.inspector}
          title="Inspector"
        >
          {inspectorPanel}
        </FloatingPanel>
      ) : null}

      {panels.logs.open ? (
        <FloatingPanel
          onActivate={() => bringPanelToFront("logs")}
          onClose={() => closePanel("logs")}
          onMove={(position) => movePanel("logs", position)}
          onPointerEnter={() => updateGraphPointerPosition(null)}
          onResize={(size) => resizePanel("logs", size)}
          position={panels.logs}
          title="Logs"
        >
          {runtimeLogsPanel}
        </FloatingPanel>
      ) : null}

      {panels.settings.open ? (
        <FloatingPanel
          onActivate={() => bringPanelToFront("settings")}
          onClose={() => closePanel("settings")}
          onMove={(position) => movePanel("settings", position)}
          onPointerEnter={() => updateGraphPointerPosition(null)}
          onResize={(size) => resizePanel("settings", size)}
          position={panels.settings}
          title="Settings"
        >
          {runtimeSettingsPanel}
        </FloatingPanel>
      ) : null}
    </>
  );
}

function createPasteGraphFragmentRequest(
  fragment: GraphFragmentV01,
  baseRevision: string
): PasteGraphFragmentRequest {
  const request: PasteGraphFragmentRequest = {
    target: {
      path: { kind: "root" },
      baseRevision
    },
    fragment,
    options: {
      idConflictPolicy: "remap",
      outsideEndpointPolicy: "omit",
      preserveRelativePositions: true
    }
  };
  const validation = validatePasteGraphFragmentRequest(request);
  if (!validation.ok) {
    throw new Error(validation.errors.join("; "));
  }
  return validation.value;
}

function graphCommandNodeId(response: RuntimeGraphCommandResponse): string | null {
  const node = response.payload.node;
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    return null;
  }
  const nodeId = (node as { nodeId?: unknown }).nodeId;
  return typeof nodeId === "string" && nodeId.length > 0 ? nodeId : null;
}

function updateActiveProjectGraph(
  project: ProjectDocumentV01,
  graph: DisplayGraphDocumentV01,
  patches: GraphPatch[]
): ProjectDocumentV01 {
  return patches.length > 0
    ? applyActiveProjectPatches(project, patches)
    : replaceProjectRootGraphFromDisplay(project, graph);
}

function createUntitledProject(): ProjectDocumentV01 {
  const graph: DisplayGraphDocumentV01 = {
    schema: "skenion.graph",
    schemaVersion: "0.1.0",
    id: "Untitled",
    revision: "1",
    nodes: [],
    edges: []
  };
  return createProjectDocument(graph, createViewStateFromPositions(graph, {}));
}

function defaultObjectNodePosition(nodeCount: number): { x: number; y: number } {
  return {
    x: 88 + (nodeCount % 2) * 300,
    y: 88 + Math.floor(nodeCount / 2) * 180
  };
}

function nodeViewStateChanged(before: ViewStateV01, after: ViewStateV01): boolean {
  return JSON.stringify(before.canvas.nodes) !== JSON.stringify(after.canvas.nodes);
}

function changedNodeViewOperations(
  graph: DisplayGraphDocumentV01,
  before: ViewStateV01,
  after: ViewStateV01
): RuntimeViewPatchOperation[] {
  const beforeView = reconcileViewStateWithGraph(graph, before);
  const afterView = reconcileViewStateWithGraph(graph, after);
  return Object.entries(afterView.canvas.nodes)
    .filter(([nodeId, nodeView]) => JSON.stringify(beforeView.canvas.nodes[nodeId]) !== JSON.stringify(nodeView))
    .map(([nodeId, to]) => ({
      op: "moveNodeView",
      nodeId,
      from: beforeView.canvas.nodes[nodeId],
      to
    }));
}

function hydrateInitialViewport(
  registry: StudioWindowRegistry,
  options: {
    project: ProjectDocumentV01;
    studioWindowId: string;
    surface: ViewportCacheSurface;
  }
): StudioWindowRegistry {
  const cachedViewport = readCachedViewport(viewportCacheKeyForProject(options.project, options.surface));
  return cachedViewport
    ? updateWindowLocalState(registry, options.studioWindowId, { viewport: cachedViewport })
    : registry;
}

function viewportCacheKeyForProject(project: ProjectDocumentV01, surface: ViewportCacheSurface) {
  return {
    documentId: project.documentId,
    graphId: project.graph.id,
    surface
  };
}

function createRuntimeScope({
  profileId,
  runtimeUrl,
  sessionId,
  windowId,
  windowMode
}: {
  profileId: RuntimeProfileId;
  runtimeUrl: string;
  sessionId: string;
  windowId: string;
  windowMode: StudioWindowMode;
}) {
  if (windowMode === "isolated-runtime") {
    return createIsolatedRuntimeScope({
      ownerWindowId: windowId,
      profileId,
      runtimeUrl,
      sessionId
    });
  }
  return createSharedRuntimeScope({
    profileId,
    runtimeUrl,
    sessionId
  });
}

async function readLocalVideoAssetMetadata(file: File): Promise<Record<string, unknown>> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = objectUrl;

  try {
    await waitForMediaEvent(video, "loadedmetadata");
    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const displaySize = videoAssetSizeForSource(sourceWidth, sourceHeight);

    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForMediaEvent(video, "loadeddata");
    }

    const seekTime = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(0.12, video.duration * 0.02)
      : 0;
    if (seekTime > 0) {
      video.currentTime = seekTime;
      await waitForMediaEvent(video, "seeked");
    }

    const canvas = document.createElement("canvas");
    canvas.width = displaySize.width;
    canvas.height = displaySize.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return {
        ...displaySize,
        sourceHeight,
        sourceWidth
      };
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      ...displaySize,
      sourceHeight,
      sourceWidth,
      thumbnailDataUrl: canvas.toDataURL("image/jpeg", 0.82)
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function runtimeSessionLoaded(session: RuntimeSessionResponse | null): boolean {
  return Boolean(session?.snapshot.project);
}

function runtimeSessionFromEvent(event: RuntimeSessionEvent): RuntimeSessionResponse {
  return {
    ok: true,
    snapshot: event.snapshot,
    issues: event.issues,
    report: null
  };
}

function waitForMediaEvent(video: HTMLVideoElement, eventName: keyof HTMLMediaElementEventMap): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${eventName}.`));
    }, 6000);
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(eventName, handleEvent);
      video.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video metadata could not be loaded."));
    };

    video.addEventListener(eventName, handleEvent, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function RuntimeRequiredPanel({ status }: { status: RuntimeConnectionStatus }) {
  return (
    <Stack className="panel-shell" gap="sm">
      <Text fw={800} size="sm">
        Runtime Required
      </Text>
      <Text c="dimmed" size="xs">
        Connect to Runtime before adding or editing graph objects.
      </Text>
      <Badge color={status === "error" ? "red" : "gray"} variant="light">
        {status}
      </Badge>
    </Stack>
  );
}

function RuntimeRequiredCanvas({ status }: { status: RuntimeConnectionStatus }) {
  return (
    <div style={{ display: "grid", height: "100%", padding: 24, placeItems: "center" }}>
      <Alert color={status === "error" ? "red" : "gray"} variant="light">
        <Text fw={800}>Runtime session required</Text>
        <Text c="dimmed" size="sm">
          Studio displays the graph owned by Runtime. Connect to Runtime to initialize or restore the current session graph.
        </Text>
      </Alert>
    </div>
  );
}

function upsertBoundedLogLine(lines: LogLine[], line: LogLine): LogLine[] {
  return [...lines.filter((current) => current.id !== line.id), line].slice(-200);
}

function downloadJson(jsonDocument: unknown, filename: string) {
  const blob = new Blob([`${JSON.stringify(jsonDocument, null, 2)}\n`], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
