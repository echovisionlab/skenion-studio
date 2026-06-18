import type { GraphNodeV01 } from "@skenion/contracts";

export const VIDEO_ASSET_NODE_KIND = "core.video-asset";

export function isVideoAssetNode(node: GraphNodeV01 | null): node is GraphNodeV01 {
  return node?.kind === VIDEO_ASSET_NODE_KIND;
}

export function defaultVideoAssetParams(): Record<string, unknown> {
  return {
    assetRef: "",
    name: "",
    mimeType: ""
  };
}

export function readVideoAssetParams(node: GraphNodeV01): {
  assetRef: string;
  name: string;
  mimeType: string;
} {
  return {
    assetRef: typeof node.params.assetRef === "string" ? node.params.assetRef : "",
    name: typeof node.params.name === "string" ? node.params.name : "",
    mimeType: typeof node.params.mimeType === "string" ? node.params.mimeType : ""
  };
}
