import { describe, expect, it } from "vitest";
import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";
import { formatPingTable, formatProbeTable } from "./table.js";
import type { ProbeEntry } from "./types.js";

describe("formatProbeTable", () => {
  it("formats success entries with icon and IP last", () => {
    const entries: ProbeEntry[] = [
      {
        name: "anthropic",
        category: "ai",
        method: "cftrace",
        target: "anthropic.com",
        usedFallback: false,
        ok: true,
        ip: "203.0.113.42",
        location: "HK",
        colo: "HKG",
        responseTimeMs: 45,
      },
    ];
    const uniqueIps: UniqueIp[] = [
      { ip: "203.0.113.42", location: "HK", count: 1 },
    ];
    const output = formatProbeTable(entries, uniqueIps, { noColor: true });
    expect(output).toContain("✓ anthropic");
    expect(output).toContain("203.0.113.42");
    expect(output).toContain("🇭🇰 HK");
    expect(output).toContain("HKG");
    expect(output).toContain("45ms");
    const headerLine = output.split("\n").find((l) => l.includes("Endpoint"));
    expect(headerLine).toMatch(/Endpoint.*Location.*Colo.*Latency.*IP/);
  });

  it("shows dash for null location/colo (http-header)", () => {
    const entries: ProbeEntry[] = [
      {
        name: "netease",
        category: "domestic",
        method: "http-header",
        target: "https://example.com",
        usedFallback: false,
        ok: true,
        ip: "10.0.0.1",
        location: null,
        colo: null,
        responseTimeMs: 12,
      },
    ];
    const output = formatProbeTable(entries, [], { noColor: true });
    expect(output).toContain("—");
  });

  it("shows error with failure icon for failed entries", () => {
    const entries: ProbeEntry[] = [
      {
        name: "bad",
        category: "test",
        method: "cftrace",
        target: "bad.com",
        usedFallback: false,
        ok: false,
        error: { code: "TIMEOUT", message: "timeout" },
        responseTimeMs: 5000,
      },
    ];
    const output = formatProbeTable(entries, [], { noColor: true });
    expect(output).toContain("✗ bad");
    expect(output).toContain("TIMEOUT");
  });

  it("shows summary line", () => {
    const entries: ProbeEntry[] = [
      {
        name: "a",
        category: "ai",
        method: "cftrace",
        target: "a.com",
        usedFallback: false,
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 50,
      },
      {
        name: "b",
        category: "ai",
        method: "cftrace",
        target: "b.com",
        usedFallback: false,
        ok: false,
        error: { code: "TIMEOUT", message: "timeout" },
        responseTimeMs: 5000,
      },
    ];
    const uniqueIps: UniqueIp[] = [
      { ip: "1.2.3.4", location: "US", count: 1 },
    ];
    const output = formatProbeTable(entries, uniqueIps, { noColor: true });
    expect(output).toContain("1/2 succeeded");
  });

  it("handles empty results", () => {
    const output = formatProbeTable([], [], { noColor: true });
    expect(output).toContain("No endpoints");
  });

  it("colorizes low latency green", () => {
    const entries: ProbeEntry[] = [
      {
        name: "fast",
        category: "ai",
        method: "cftrace",
        target: "fast.com",
        usedFallback: false,
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 100,
      },
    ];
    const output = formatProbeTable(entries, [], { noColor: false });
    expect(output).toContain("\x1b[32m100ms\x1b[0m");
  });

  it("colorizes medium latency yellow", () => {
    const entries: ProbeEntry[] = [
      {
        name: "medium",
        category: "ai",
        method: "cftrace",
        target: "medium.com",
        usedFallback: false,
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 500,
      },
    ];
    const output = formatProbeTable(entries, [], { noColor: false });
    expect(output).toContain("\x1b[33m500ms\x1b[0m");
  });

  it("colorizes high latency red", () => {
    const entries: ProbeEntry[] = [
      {
        name: "slow",
        category: "ai",
        method: "cftrace",
        target: "slow.com",
        usedFallback: false,
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 1500,
      },
    ];
    const output = formatProbeTable(entries, [], { noColor: false });
    expect(output).toContain("\x1b[31m1500ms\x1b[0m");
  });
});

describe("formatPingTable", () => {
  it("formats successful ping results with icon", () => {
    const results: PingResult[] = [
      { name: "ping-github", tag: "international", ok: true, medianMs: 85, rounds: [92, 88, 85] },
    ];
    const output = formatPingTable(results, { noColor: true });
    expect(output).toContain("✓ ping-github");
    expect(output).toContain("85ms");
    expect(output).toContain("international");
  });

  it("shows FAILED with failure icon for unreachable targets", () => {
    const results: PingResult[] = [
      {
        name: "ping-youtube",
        tag: "international",
        ok: false,
        medianMs: null,
        rounds: [-1, -1, -1],
        error: { code: "ALL_FAILED", message: "All failed" },
      },
    ];
    const output = formatPingTable(results, { noColor: true });
    expect(output).toContain("✗ ping-youtube");
    expect(output).toContain("FAILED");
  });

  it("handles empty results", () => {
    const output = formatPingTable([], { noColor: true });
    expect(output).toContain("No ping targets");
  });

  it("applies color when noColor is false", () => {
    const results: PingResult[] = [
      {
        name: "ping-bad",
        tag: "test",
        ok: false,
        medianMs: null,
        rounds: [-1],
        error: { code: "ALL_FAILED", message: "All failed" },
      },
    ];
    const output = formatPingTable(results, { noColor: false });
    expect(output).toContain("\x1b[31m");
  });

  it("colorizes ping latency", () => {
    const results: PingResult[] = [
      { name: "ping-fast", tag: "test", ok: true, medianMs: 50, rounds: [50] },
    ];
    const output = formatPingTable(results, { noColor: false });
    expect(output).toContain("\x1b[32m50ms\x1b[0m");
  });
});
