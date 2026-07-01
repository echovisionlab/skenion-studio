import { Stack, Text } from "@mantine/core";
import { useState } from "react";
import type { ShaderIssueV01 } from "@skenion/contracts";
import { ConnectionIssuesPanel } from "./inspector/ConnectionIssuesPanel";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { FeedbackPolicyDialog } from "./inspector/FeedbackPolicyDialog";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeInspector } from "./inspector/NodeInspector";
import type {
  EdgeInspectorModel,
  GraphSemanticIssue
} from "../graph/portSemantics";
import type { ConnectionCheck } from "../graph/skenionGraph";
import type { DisplayGraphDocumentV01, DisplayGraphNodeV01 } from "../graph/patchLibrary";
import type { RuntimeGeneratedShaderResponse } from "../runtime/types";

interface InspectorPanelProps {
  connectionCheck: ConnectionCheck | null;
  edge: EdgeInspectorModel | null;
  graphLocked: boolean;
  graph: DisplayGraphDocumentV01;
  node: DisplayGraphNodeV01 | null;
  semanticIssues: GraphSemanticIssue[];
  generatedShader: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy: boolean;
  runtimeAssetImportBusy: boolean;
  runtimeAssetImportEnabled: boolean;
  runtimeShaderIssues: ShaderIssueV01[];
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void>;
  onLoadGeneratedShader?: () => void;
  onRemoveNode: (node: DisplayGraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
}

export function InspectorPanel({
  connectionCheck,
  edge,
  graph,
  graphLocked,
  generatedShader,
  generatedShaderBusy,
  node,
  onImportAsset,
  onLoadGeneratedShader,
  onRemoveNode,
  onSetNodeParam,
  onSyncShaderInputs,
  runtimeAssetImportBusy,
  runtimeAssetImportEnabled,
  runtimeShaderIssues,
  semanticIssues
}: InspectorPanelProps) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const selectedEdgeIssues = edge
    ? semanticIssues.filter((issue) => issue.edgeId === edge.id)
    : [];
  return (
    <InspectorShell edgeCount={graph.edges.length} nodeCount={graph.nodes.length}>
      <FeedbackPolicyDialog
        edge={edge}
        onClose={() => setFeedbackDialogOpen(false)}
        opened={feedbackDialogOpen}
      />
      <Stack gap="md">
        <ConnectionIssuesPanel connectionCheck={connectionCheck} />

        {edge ? (
          <EdgeInspector
            issues={selectedEdgeIssues}
            edge={edge}
            onOpenFeedbackDialog={() => setFeedbackDialogOpen(true)}
          />
        ) : node ? (
          <NodeInspector
            generatedShader={generatedShader}
            generatedShaderBusy={generatedShaderBusy}
            node={node}
            graphLocked={graphLocked}
            onLoadGeneratedShader={onLoadGeneratedShader}
            onImportAsset={onImportAsset}
            onRemoveNode={onRemoveNode}
            onSetNodeParam={onSetNodeParam}
            onSyncShaderInputs={onSyncShaderInputs}
            runtimeAssetImportBusy={runtimeAssetImportBusy}
            runtimeAssetImportEnabled={runtimeAssetImportEnabled}
            runtimeShaderIssues={runtimeShaderIssues}
          />
        ) : (
          <Text c="dimmed" size="sm">
            Select a node or edge on the canvas.
          </Text>
        )}
      </Stack>
    </InspectorShell>
  );
}
