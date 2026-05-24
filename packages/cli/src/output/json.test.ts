import { describe, expect, it } from "vitest";
import { formatJson } from "./json.js";
import type { FullOutput } from "./types.js";

describe("formatJson", () => {
  it("serializes mode=all with both sections", () => {
    const output: FullOutput = {
      mode: "all",
      probe: {
        results: [
          {
            name: "openai",
            category: "ai",
            method: "cftrace",
            target: "openai.com",
            usedFallback: false,
            ok: true,
            ip: "203.0.113.42",
            location: "HK",
            colo: "HKG",
            responseTimeMs: 45,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
        uniqueIps: [{ ip: "203.0.113.42", location: "HK", count: 1 }],
      },
      ping: {
        results: [
          {
            name: "ping-github",
            tag: "international",
            ok: true,
            medianMs: 85,
            rounds: [92, 88, 85],
          },
        ],
      },
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("all");
    expect(parsed.probe.results).toHaveLength(1);
    expect(parsed.probe.results[0].name).toBe("openai");
    expect(parsed.ping.results).toHaveLength(1);
  });

  it("serializes mode=probe with ping=null", () => {
    const output: FullOutput = {
      mode: "probe",
      probe: {
        results: [],
        summary: { total: 0, succeeded: 0, failed: 0 },
        uniqueIps: [],
      },
      ping: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("probe");
    expect(parsed.probe).toBeDefined();
    expect(parsed.ping).toBeNull();
  });

  it("serializes mode=ping with probe=null", () => {
    const output: FullOutput = {
      mode: "ping",
      probe: null,
      ping: { results: [] },
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("ping");
    expect(parsed.probe).toBeNull();
    expect(parsed.ping).toBeDefined();
  });

  it("includes error object and responseTimeMs: null for connection-level failures", () => {
    const output: FullOutput = {
      mode: "probe",
      probe: {
        results: [
          {
            name: "bad",
            category: "test",
            method: "cftrace",
            target: "bad.com",
            usedFallback: false,
            ok: false,
            error: { code: "DNS_FAILED", message: "DNS failed" },
            responseTimeMs: null,
          },
        ],
        summary: { total: 1, succeeded: 0, failed: 1 },
        uniqueIps: [],
      },
      ping: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.probe.results[0].responseTimeMs).toBeNull();
    expect(parsed.probe.results[0].error.code).toBe("DNS_FAILED");
    expect(parsed.probe.results[0].error.message).toBe("DNS failed");
    expect(parsed.probe.results[0].code).toBeUndefined();
  });

  it("includes resolvedTarget when fallback used", () => {
    const output: FullOutput = {
      mode: "probe",
      probe: {
        results: [
          {
            name: "discord",
            category: "social",
            method: "cftrace",
            target: "discord.com",
            resolvedTarget: "gateway.discord.gg",
            usedFallback: true,
            ok: true,
            ip: "1.2.3.4",
            location: "US",
            colo: "LAX",
            responseTimeMs: 180,
          },
        ],
        summary: { total: 1, succeeded: 1, failed: 0 },
        uniqueIps: [{ ip: "1.2.3.4", location: "US", count: 1 }],
      },
      ping: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.probe.results[0].resolvedTarget).toBe("gateway.discord.gg");
    expect(parsed.probe.results[0].usedFallback).toBe(true);
  });

  it("outputs valid JSON string", () => {
    const output: FullOutput = {
      mode: "all",
      probe: {
        results: [],
        summary: { total: 0, succeeded: 0, failed: 0 },
        uniqueIps: [],
      },
      ping: { results: [] },
    };

    const json = formatJson(output);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
