import { Stack, Text } from "@mantine/core";
import { useState } from "react";
import { EdgeInspector } from "./inspector/EdgeInspector";
import { FeedbackPolicyDialog } from "./inspector/FeedbackPolicyDialog";
import { InspectorShell } from "./inspector/InspectorShell";
import { NodeInspector } from "./inspector/NodeInspector";
import type { EdgeInspectorModel } from "../graph/portSemantics";
import type { DisplayGraphNodeV01 } from "../graph/patchLibrary";
import type { RuntimeGeneratedShaderResponse } from "../runtime/types";
import type { RuntimeControlValue } from "../runtime/types";

interface InspectorPanelProps {
  edge: EdgeInspectorModel | null;
  graphLocked: boolean;
  node: DisplayGraphNodeV01 | null;
  generatedShader: RuntimeGeneratedShaderResponse | null;
  generatedShaderBusy: boolean;
  runtimeAssetImportBusy: boolean;
  runtimeAssetImportEnabled: boolean;
  runtimeControlValue?: RuntimeControlValue;
  onImportAsset?: (node: DisplayGraphNodeV01, file: File) => Promise<void>;
  onLoadGeneratedShader?: () => void;
  onRemoveNode: (node: DisplayGraphNodeV01) => void;
  onSetNodeParam: (nodeId: string, key: string, value: unknown) => void;
  onSyncShaderInputs: (nodeId: string, source: string) => void;
}

export function InspectorPanel({
  edge,
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
  runtimeControlValue
}: InspectorPanelProps) {
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  return (
    <InspectorShell>
      <FeedbackPolicyDialog
        edge={edge}
        onClose={() => setFeedbackDialogOpen(false)}
        opened={feedbackDialogOpen}
      />
      <Stack gap="md">
        {edge ? (
          <EdgeInspector
            edge={edge}
            onOpenFeedbackDialog={() => setFeedbackDialogOpen(true)}
          />
        ) : node ? (
          <NodeInspector
            generatedShader={generatedShader}
            generatedShaderBusy={generatedShaderBusy}
            node={node}
            graphLocked={graphLocked}
            runtimeControlValue={runtimeControlValue}
            onLoadGeneratedShader={onLoadGeneratedShader}
            onImportAsset={onImportAsset}
            onRemoveNode={onRemoveNode}
            onSetNodeParam={onSetNodeParam}
            onSyncShaderInputs={onSyncShaderInputs}
            runtimeAssetImportBusy={runtimeAssetImportBusy}
            runtimeAssetImportEnabled={runtimeAssetImportEnabled}
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
