import { describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "fs/promises";
import path from "path";

import { isSafeFrameId, loadPreviewFrameImages } from "@/lib/media";

describe("media helpers", () => {
  it("validates safe frame ids", () => {
    expect(isSafeFrameId("7cbbf3a2-7410-4b9d-9a74-652f1188dc76.jpg")).toBe(true);
    expect(isSafeFrameId("7cbbf3a2-7410-4b9d-9a74-652f1188dc76.png")).toBe(false);
    expect(isSafeFrameId("../secret.jpg")).toBe(false);
    expect(isSafeFrameId("not-a-uuid.jpg")).toBe(false);
  });

  it("loads only safe preview frame images for multimodal analysis", async () => {
    const frameId = "7cbbf3a2-7410-4b9d-9a74-652f1188dc76.jpg";
    const framePath = path.join(process.cwd(), "data", "frames", frameId);
    await mkdir(path.dirname(framePath), { recursive: true });
    await writeFile(framePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

    try {
      const images = await loadPreviewFrameImages([frameId, "../secret.jpg"], 2);

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        frameId,
        mediaType: "image/jpeg",
        label: "样例视频关键帧 1",
      });
      expect(images[0]?.data.length).toBeGreaterThan(0);
    } finally {
      await rm(framePath, { force: true });
    }
  });
});
