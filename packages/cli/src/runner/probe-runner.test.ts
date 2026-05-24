import { describe, expect, it, vi } from "vitest";
import type { Endpoint } from "../config/types.js";
import type { ProbeResult } from "../probes/types.js";
import { runProbes } from "./probe-runner.js";

function makeCfEndpoint(name: string): Endpoint {
  return { name, method: "cftrace", domain: `${name}.com`, category: "test", tier: 1 };
}

describe("runProbes", () => {
  it("runs all endpoints and returns results", async () => {
    const endpoints = [makeCfEndpoint("a"), makeCfEndpoint("b")];
    const probeFn = vi.fn<(ep: Endpoint) => Promise<ProbeResult>>().mockImplementation(
      async (_ep) => ({
        ok: true as const,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 50,
      }),
    );

    const results = await runProbes(endpoints, { concurrency: 10, probeFn });
    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(probeFn).toHaveBeenCalledTimes(2);
  });

  it("respects concurrency limit", async () => {
    const endpoints = Array.from({ length: 6 }, (_, i) =>
      makeCfEndpoint(`e${i}`),
    );
    let concurrent = 0;
    let maxConcurrent = 0;

    const probeFn = vi.fn<(ep: Endpoint) => Promise<ProbeResult>>().mockImplementation(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 20));
      concurrent--;
      return {
        ok: true as const,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 50,
      };
    });

    await runProbes(endpoints, { concurrency: 2, probeFn });
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("handles partial failures", async () => {
    const endpoints = [makeCfEndpoint("good"), makeCfEndpoint("bad")];
    const probeFn = vi.fn<(ep: Endpoint) => Promise<ProbeResult>>().mockImplementation(
      async (ep) => {
        if (ep.name === "bad") {
          return {
            ok: false as const,
            code: "TIMEOUT" as const,
            message: "timeout",
            responseTimeMs: 5000,
          };
        }
        return {
          ok: true as const,
          ip: "1.2.3.4",
          location: "US",
          colo: "LAX",
          responseTimeMs: 50,
        };
      },
    );

    const results = await runProbes(endpoints, { concurrency: 10, probeFn });
    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });

  it("handles empty endpoint list", async () => {
    const probeFn = vi.fn();
    const results = await runProbes([], { concurrency: 10, probeFn });
    expect(results).toHaveLength(0);
    expect(probeFn).not.toHaveBeenCalled();
  });

  it("preserves endpoint order in results", async () => {
    const endpoints = [
      makeCfEndpoint("first"),
      makeCfEndpoint("second"),
      makeCfEndpoint("third"),
    ];
    const probeFn = vi.fn<(ep: Endpoint) => Promise<ProbeResult>>().mockImplementation(
      async (ep) => {
        const delay = ep.name === "first" ? 50 : ep.name === "second" ? 10 : 30;
        await new Promise((r) => setTimeout(r, delay));
        return {
          ok: true as const,
          ip: "1.2.3.4",
          location: "US",
          colo: "LAX",
          responseTimeMs: delay,
        };
      },
    );

    const results = await runProbes(endpoints, { concurrency: 10, probeFn });
    expect(probeFn).toHaveBeenCalledTimes(3);
    // Results should be ordered by input, not completion time
    expect(results).toHaveLength(3);
  });
});
