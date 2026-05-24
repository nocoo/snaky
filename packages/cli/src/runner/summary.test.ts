import { describe, it, expect } from "vitest";
import { buildUniqueSummary } from "./summary.js";
import type { ProbeResult } from "../probes/types.js";

describe("buildUniqueSummary", () => {
  it("deduplicates by IP and counts occurrences", () => {
    const results: ProbeResult[] = [
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 50 },
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 60 },
      { ok: true, ip: "5.6.7.8", location: "HK", colo: "HKG", responseTimeMs: 70 },
    ];
    const summary = buildUniqueSummary(results);
    expect(summary).toHaveLength(2);
    expect(summary[0]).toEqual({ ip: "1.2.3.4", location: "US", count: 2 });
    expect(summary[1]).toEqual({ ip: "5.6.7.8", location: "HK", count: 1 });
  });

  it("sorts by count descending", () => {
    const results: ProbeResult[] = [
      { ok: true, ip: "a.a.a.a", location: "US", colo: "LAX", responseTimeMs: 50 },
      { ok: true, ip: "b.b.b.b", location: "HK", colo: "HKG", responseTimeMs: 50 },
      { ok: true, ip: "b.b.b.b", location: "HK", colo: "HKG", responseTimeMs: 50 },
      { ok: true, ip: "b.b.b.b", location: "HK", colo: "HKG", responseTimeMs: 50 },
    ];
    const summary = buildUniqueSummary(results);
    expect(summary[0]!.ip).toBe("b.b.b.b");
    expect(summary[0]!.count).toBe(3);
  });

  it("handles null location from http-header probes", () => {
    const results: ProbeResult[] = [
      { ok: true, ip: "10.0.0.1", location: null, colo: null, responseTimeMs: 10 },
    ];
    const summary = buildUniqueSummary(results);
    expect(summary[0]).toEqual({ ip: "10.0.0.1", location: null, count: 1 });
  });

  it("ignores failed probes", () => {
    const results: ProbeResult[] = [
      { ok: true, ip: "1.2.3.4", location: "US", colo: "LAX", responseTimeMs: 50 },
      { ok: false, code: "TIMEOUT", message: "timeout", responseTimeMs: 5000 },
    ];
    const summary = buildUniqueSummary(results);
    expect(summary).toHaveLength(1);
  });

  it("returns empty for all failures", () => {
    const results: ProbeResult[] = [
      { ok: false, code: "TIMEOUT", message: "timeout", responseTimeMs: 5000 },
    ];
    const summary = buildUniqueSummary(results);
    expect(summary).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(buildUniqueSummary([])).toHaveLength(0);
  });
});
