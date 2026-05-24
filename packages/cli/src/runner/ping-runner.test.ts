import { describe, expect, it, vi } from "vitest";
import type { PingTarget } from "../config/types.js";
import { runPing } from "./ping-runner.js";

function makeTarget(name: string): PingTarget {
  return { name, url: `https://${name}.com/health`, tag: "test", tier: 1 };
}

describe("runPing", () => {
  it("runs warmup + measured rounds", async () => {
    const targets = [makeTarget("a")];
    const pingFn = vi.fn().mockResolvedValue(50);

    const results = await runPing(targets, {
      rounds: 3,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    // 1 warmup + 3 measured = 4 total calls per target
    expect(pingFn).toHaveBeenCalledTimes(4);
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.rounds).toHaveLength(3);
    expect(results[0]?.medianMs).toBe(50);
  });

  it("warmup is not counted in rounds array", async () => {
    const targets = [makeTarget("a")];
    let callCount = 0;
    const pingFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? 999 : 50; // warmup returns 999
    });

    const results = await runPing(targets, {
      rounds: 3,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    expect(results[0]?.rounds).toEqual([50, 50, 50]);
    expect(results[0]?.rounds).not.toContain(999);
  });

  it("calculates median correctly", async () => {
    const targets = [makeTarget("a")];
    let callIdx = 0;
    const values = [100, 20, 80, 40, 60]; // warmup=100, rounds: 20,80,40,60
    const pingFn = vi.fn().mockImplementation(async () => values[callIdx++]);

    const results = await runPing(targets, {
      rounds: 4,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    // Sorted successful: [20, 40, 60, 80], median = (40+60)/2 = 50
    expect(results[0]?.medianMs).toBe(50);
  });

  it("handles all rounds failed", async () => {
    const targets = [makeTarget("a")];
    const pingFn = vi.fn().mockResolvedValue(-1);

    const results = await runPing(targets, {
      rounds: 3,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.medianMs).toBeNull();
    expect(results[0]?.rounds).toEqual([-1, -1, -1]);
    expect(results[0]?.error).toBeDefined();
    expect(results[0]?.error?.code).toBe("ALL_FAILED");
  });

  it("handles partial success (median of successful only)", async () => {
    const targets = [makeTarget("a")];
    let callIdx = 0;
    const values = [50, 80, -1, 60, -1, 40]; // warmup=50, rounds: 80,-1,60,-1,40
    const pingFn = vi.fn().mockImplementation(async () => values[callIdx++]);

    const results = await runPing(targets, {
      rounds: 5,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.rounds).toEqual([80, -1, 60, -1, 40]);
    // Successful: [40, 60, 80], median = 60
    expect(results[0]?.medianMs).toBe(60);
  });

  it("probes all targets concurrently within each round", async () => {
    const targets = [makeTarget("a"), makeTarget("b"), makeTarget("c")];
    const pingFn = vi.fn().mockResolvedValue(30);

    const results = await runPing(targets, {
      rounds: 2,
      pingTimeout: 3000,
      concurrency: 10,
      pingFn,
    });

    expect(results).toHaveLength(3);
    // 3 targets × (1 warmup + 2 rounds) = 9 calls
    expect(pingFn).toHaveBeenCalledTimes(9);
  });
});
