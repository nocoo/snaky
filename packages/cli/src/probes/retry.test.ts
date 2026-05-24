import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry.js";
import type { ProbeResult } from "./types.js";

describe("withRetry", () => {
  it("returns on first success (no retry)", async () => {
    const fn = vi.fn<() => Promise<ProbeResult>>().mockResolvedValue({
      ok: true,
      ip: "1.2.3.4",
      location: "US",
      colo: "LAX",
      responseTimeMs: 50,
    });
    const result = await withRetry(fn, { retries: 2 });
    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn<() => Promise<ProbeResult>>()
      .mockResolvedValueOnce({
        ok: false,
        code: "TIMEOUT",
        message: "timeout",
        responseTimeMs: 5000,
      })
      .mockResolvedValueOnce({
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 50,
      });

    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    vi.useRealTimers();

    expect(result.ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("exhausts all retries and returns last failure", async () => {
    const fn = vi.fn<() => Promise<ProbeResult>>().mockResolvedValue({
      ok: false,
      code: "TIMEOUT",
      message: "timeout",
      responseTimeMs: 5000,
    });

    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    const result = await promise;
    vi.useRealTimers();

    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does not retry when retries = 0", async () => {
    const fn = vi.fn<() => Promise<ProbeResult>>().mockResolvedValue({
      ok: false,
      code: "TIMEOUT",
      message: "timeout",
      responseTimeMs: 5000,
    });

    const result = await withRetry(fn, { retries: 0 });
    expect(result.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("applies exponential backoff (2s, 4s)", async () => {
    const fn = vi.fn<() => Promise<ProbeResult>>().mockResolvedValue({
      ok: false,
      code: "TIMEOUT",
      message: "timeout",
      responseTimeMs: 5000,
    });

    vi.useFakeTimers();
    const promise = withRetry(fn, { retries: 2 });

    // Initial call is immediate
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 2s: first retry
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 4s more: second retry
    await vi.advanceTimersByTimeAsync(4000);
    expect(fn).toHaveBeenCalledTimes(3);

    await promise;
    vi.useRealTimers();
  });
});
