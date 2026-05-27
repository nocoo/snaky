import { describe, expect, it } from "vitest";
import { formatJson } from "./json.js";
import type { FullOutput } from "./types.js";

describe("formatJson", () => {
  it("serializes mode=all with all sections", () => {
    const output: FullOutput = {
      mode: "all",
      split: {
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
      connect: {
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
      dns: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("all");
    expect(parsed.split.results).toHaveLength(1);
    expect(parsed.split.results[0].name).toBe("openai");
    expect(parsed.connect.results).toHaveLength(1);
    expect(parsed.dns).toBeNull();
  });

  it("serializes mode=split with connect=null", () => {
    const output: FullOutput = {
      mode: "split",
      split: {
        results: [],
        summary: { total: 0, succeeded: 0, failed: 0 },
        uniqueIps: [],
      },
      connect: null,
      dns: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("split");
    expect(parsed.split).toBeDefined();
    expect(parsed.connect).toBeNull();
  });

  it("serializes mode=connect with split=null", () => {
    const output: FullOutput = {
      mode: "connect",
      split: null,
      connect: { results: [] },
      dns: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.mode).toBe("connect");
    expect(parsed.split).toBeNull();
    expect(parsed.connect).toBeDefined();
  });

  it("includes error object and responseTimeMs: null for connection-level failures", () => {
    const output: FullOutput = {
      mode: "split",
      split: {
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
      connect: null,
      dns: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.split.results[0].responseTimeMs).toBeNull();
    expect(parsed.split.results[0].error.code).toBe("DNS_FAILED");
    expect(parsed.split.results[0].error.message).toBe("DNS failed");
    expect(parsed.split.results[0].code).toBeUndefined();
  });

  it("includes resolvedTarget when fallback used", () => {
    const output: FullOutput = {
      mode: "split",
      split: {
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
      connect: null,
      dns: null,
    };

    const json = formatJson(output);
    const parsed = JSON.parse(json);
    expect(parsed.split.results[0].resolvedTarget).toBe("gateway.discord.gg");
    expect(parsed.split.results[0].usedFallback).toBe(true);
  });

  it("outputs valid JSON string", () => {
    const output: FullOutput = {
      mode: "all",
      split: {
        results: [],
        summary: { total: 0, succeeded: 0, failed: 0 },
        uniqueIps: [],
      },
      connect: { results: [] },
      dns: null,
    };

    const json = formatJson(output);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});
