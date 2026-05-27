import { describe, expect, it } from "vitest";
import type { ProbeResult } from "../probes/types.js";
import type { PingResult } from "../runner/ping-runner.js";
import { computeExitCode } from "./exit-code.js";

describe("computeExitCode", () => {
  it("returns 0 when all probes succeed", () => {
    const probes: ProbeResult[] = [
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 50 },
      { ok: true, ip: "5.6.7.8", location: "HK", colo: "HKG", responseTimeMs: 60 },
    ];
    expect(computeExitCode("all", probes, [])).toBe(0);
  });

  it("returns 1 when some probes fail", () => {
    const probes: ProbeResult[] = [
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 50 },
      { ok: false, code: "TIMEOUT", message: "timeout", responseTimeMs: 5000 },
    ];
    expect(computeExitCode("all", probes, [])).toBe(1);
  });

  it("returns 2 when all probes fail", () => {
    const probes: ProbeResult[] = [
      { ok: false, code: "TIMEOUT", message: "timeout", responseTimeMs: 5000 },
      { ok: false, code: "DNS_FAILED", message: "dns", responseTimeMs: null },
    ];
    expect(computeExitCode("all", probes, [])).toBe(2);
  });

  it("returns 0 for empty probes (no endpoints)", () => {
    expect(computeExitCode("all", [], [])).toBe(0);
    expect(computeExitCode("split", [], null)).toBe(0);
  });

  it("ping failures do not affect exit code in all mode", () => {
    const probes: ProbeResult[] = [
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 50 },
    ];
    const pings: PingResult[] = [
      { name: "a", tag: "x", ok: false, medianMs: null, rounds: [-1], error: { code: "ALL_FAILED", message: "all" } },
    ];
    expect(computeExitCode("all", probes, pings)).toBe(0);
  });

  it("connect-only mode: 0 = all reachable", () => {
    const pings: PingResult[] = [
      { name: "a", tag: "x", ok: true, medianMs: 50, rounds: [50] },
    ];
    expect(computeExitCode("connect", null, pings)).toBe(0);
  });

  it("connect-only mode: 1 = some unreachable", () => {
    const pings: PingResult[] = [
      { name: "a", tag: "x", ok: true, medianMs: 50, rounds: [50] },
      { name: "b", tag: "x", ok: false, medianMs: null, rounds: [-1], error: { code: "ALL_FAILED", message: "all" } },
    ];
    expect(computeExitCode("connect", null, pings)).toBe(1);
  });

  it("connect-only mode: 2 = all unreachable", () => {
    const pings: PingResult[] = [
      { name: "a", tag: "x", ok: false, medianMs: null, rounds: [-1], error: { code: "ALL_FAILED", message: "all" } },
    ];
    expect(computeExitCode("connect", null, pings)).toBe(2);
  });
});
