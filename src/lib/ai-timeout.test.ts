import { describe, expect, it } from "vitest";

import { raceWithTimeout, readTimeoutMs } from "@/lib/ai-timeout";

describe("readTimeoutMs", () => {
  it("uses fallback for missing or invalid values", () => {
    expect(readTimeoutMs("AI_TEST_TIMEOUT_MS", 1200, {})).toBe(1200);
    expect(readTimeoutMs("AI_TEST_TIMEOUT_MS", 1200, { AI_TEST_TIMEOUT_MS: "bad" })).toBe(1200);
  });

  it("accepts positive integer-like values and allows 0 to disable", () => {
    expect(readTimeoutMs("AI_TEST_TIMEOUT_MS", 1200, { AI_TEST_TIMEOUT_MS: "2400.8" })).toBe(2400);
    expect(readTimeoutMs("AI_TEST_TIMEOUT_MS", 1200, { AI_TEST_TIMEOUT_MS: "0" })).toBe(0);
  });
});

describe("raceWithTimeout", () => {
  it("returns the original result before the timeout", async () => {
    await expect(raceWithTimeout(Promise.resolve("ok"), 50, "fast task")).resolves.toBe("ok");
  });

  it("rejects with a readable timeout error", async () => {
    const slowTask = new Promise((resolve) => setTimeout(() => resolve("late"), 30));
    await expect(raceWithTimeout(slowTask, 1, "slow task")).rejects.toThrow(
      "slow task timed out after 1ms",
    );
  });
});
