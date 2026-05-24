import { describe, expect, it } from "vitest";

import { isSafeFrameId } from "@/lib/media";

describe("media helpers", () => {
  it("validates safe frame ids", () => {
    expect(isSafeFrameId("7cbbf3a2-7410-4b9d-9a74-652f1188dc76.jpg")).toBe(true);
    expect(isSafeFrameId("7cbbf3a2-7410-4b9d-9a74-652f1188dc76.png")).toBe(false);
    expect(isSafeFrameId("../secret.jpg")).toBe(false);
    expect(isSafeFrameId("not-a-uuid.jpg")).toBe(false);
  });
});

