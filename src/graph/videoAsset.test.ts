import { describe, expect, it } from "vitest";
import type { GraphNodeV01 } from "@skenion/contracts";
import {
  VIDEO_ASSET_NODE_KIND,
  defaultVideoAssetParams,
  isVideoAssetNode,
  readVideoAssetParams
} from "./videoAsset";

describe("video asset graph helpers", () => {
  it("identifies video asset nodes and creates default params", () => {
    const node = videoAssetNode({
      assetRef: "skenion-runtime://assets/asset_1",
      name: "clip.mov",
      mimeType: "video/quicktime"
    });

    expect(isVideoAssetNode(node)).toBe(true);
    expect(isVideoAssetNode({ ...node, kind: "core.comment" })).toBe(false);
    expect(isVideoAssetNode(null)).toBe(false);
    expect(defaultVideoAssetParams()).toEqual({
      assetRef: "",
      name: "",
      mimeType: ""
    });
  });

  it("reads only string asset params", () => {
    expect(
      readVideoAssetParams(
        videoAssetNode({
          assetRef: "skenion-runtime://assets/asset_1",
          name: "clip.mp4",
          mimeType: "video/mp4"
        })
      )
    ).toEqual({
      assetRef: "skenion-runtime://assets/asset_1",
      name: "clip.mp4",
      mimeType: "video/mp4"
    });

    expect(readVideoAssetParams(videoAssetNode({ assetRef: false, name: 42, mimeType: null }))).toEqual({
      assetRef: "",
      name: "",
      mimeType: ""
    });
  });
});

function videoAssetNode(params: Record<string, unknown>): GraphNodeV01 {
  return {
    id: "asset_1",
    kind: VIDEO_ASSET_NODE_KIND,
    kindVersion: "0.1.0",
    params,
    ports: []
  };
}
