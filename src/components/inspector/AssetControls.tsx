import { Alert, FileButton, Stack, Text, TextInput } from "@mantine/core";
import { Upload } from "lucide-react";
import type { GraphNodeV01 } from "@skenion/contracts";
import { readVideoAssetParams } from "../../graph/videoAsset";
import { Button } from "../core/Button/Button";

export interface AssetControlsProps {
  busy?: boolean;
  enabled: boolean;
  node: GraphNodeV01;
  onImportAsset?: (node: GraphNodeV01, file: File) => Promise<void>;
}

export function AssetControls({
  busy = false,
  enabled,
  node,
  onImportAsset
}: AssetControlsProps) {
  const asset = readVideoAssetParams(node);

  return (
    <Stack gap="xs">
      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
        Asset
      </Text>
      <TextInput label="Asset ref" readOnly size="xs" value={asset.assetRef} />
      <TextInput label="Name" readOnly size="xs" value={asset.name} />
      <TextInput label="MIME type" readOnly size="xs" value={asset.mimeType} />
      {!enabled ? (
        <Alert color="yellow" radius="sm" variant="light">
          Runtime connection is required to import local assets.
        </Alert>
      ) : null}
      {!asset.assetRef ? (
        <Alert color="yellow" radius="sm" variant="light">
          This asset node has no imported runtime asset reference.
        </Alert>
      ) : null}
      <FileButton
        accept="video/*"
        disabled={!enabled || busy || !onImportAsset}
        onChange={(file) => {
          if (file && onImportAsset) {
            void onImportAsset(node, file);
          }
        }}
      >
        {(props) => (
          <Button
            disabled={!enabled || busy || !onImportAsset}
            leftSection={<Upload size={15} />}
            loading={busy}
            radius="sm"
            size="compact-sm"
            variant="light"
            {...props}
          >
            Import video asset
          </Button>
        )}
      </FileButton>
      <Text c="dimmed" size="xs">
        Import stores a Runtime assetRef on this node.
      </Text>
    </Stack>
  );
}
