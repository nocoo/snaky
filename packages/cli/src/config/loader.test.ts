import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./loader.js";

describe("loadConfig", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaky-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns defaults when no config file", () => {
    const result = loadConfig(join(dir, "nonexistent.json"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.settings.timeout).toBe(5000);
    expect(result.config.endpoints.length).toBeGreaterThan(0);
    expect(result.config.pingTargets.length).toBeGreaterThan(0);
  });

  it("merges user endpoints with defaults", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        endpoints: [
          { name: "custom", method: "cftrace", domain: "custom.com" },
        ],
      }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const custom = result.config.endpoints.find((e) => e.name === "custom");
    expect(custom).toBeDefined();
    expect(custom?.category).toBe("user");
    // Built-ins still present
    const anthropic = result.config.endpoints.find(
      (e) => e.name === "anthropic",
    );
    expect(anthropic).toBeDefined();
  });

  it("user endpoint overrides built-in with same name", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        endpoints: [
          { name: "openai", method: "cftrace", domain: "custom-openai.com" },
        ],
      }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const openai = result.config.endpoints.find((e) => e.name === "openai");
    expect(openai).toBeDefined();
    if (openai?.method === "cftrace") {
      expect(openai.domain).toBe("custom-openai.com");
      expect(openai.category).toBe("user");
    }
  });

  it("disabled built-in is excluded from effective config", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        endpoints: [{ name: "openai", disabled: true }],
      }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const openai = result.config.endpoints.find((e) => e.name === "openai");
    expect(openai).toBeUndefined();
  });

  it("disabled user endpoint is excluded", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        endpoints: [
          {
            name: "custom",
            method: "cftrace",
            domain: "custom.com",
            disabled: true,
          },
        ],
      }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const custom = result.config.endpoints.find((e) => e.name === "custom");
    expect(custom).toBeUndefined();
  });

  it("merges settings from config", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({ timeout: 3000, concurrency: 5 }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.settings.timeout).toBe(3000);
    expect(result.config.settings.concurrency).toBe(5);
    expect(result.config.settings.retries).toBe(2); // default
  });

  it("returns error for malformed JSON", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, "not json at all{{{");
    const result = loadConfig(configPath);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/parse|json/i);
  });

  it("returns error for invalid config values", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ timeout: -5 }));
    const result = loadConfig(configPath);
    expect(result.ok).toBe(false);
  });

  it("merges user ping targets", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        pingTargets: [
          { name: "my-ping", url: "https://my.com/health", tag: "custom" },
        ],
      }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const myPing = result.config.pingTargets.find(
      (t) => t.name === "my-ping",
    );
    expect(myPing).toBeDefined();
    // Built-in ping targets still present
    const github = result.config.pingTargets.find(
      (t) => t.name === "ping-github",
    );
    expect(github).toBeDefined();
  });

  it("provides dnsLeak defaults when not in config", () => {
    const result = loadConfig(undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.dnsLeak.rounds).toBe(5);
    expect(result.config.dnsLeak.expectedResolvers).toBeUndefined();
  });

  it("merges partial dnsLeak config", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(configPath, JSON.stringify({ dnsLeak: { rounds: 8 } }));
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.dnsLeak.rounds).toBe(8);
    expect(result.config.dnsLeak.expectedResolvers).toBeUndefined();
  });

  it("merges dnsLeak with expectedResolvers", () => {
    const configPath = join(dir, "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({ dnsLeak: { rounds: 3, expectedResolvers: ["1.1.1.0/24"] } }),
    );
    const result = loadConfig(configPath);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.dnsLeak.rounds).toBe(3);
    expect(result.config.dnsLeak.expectedResolvers).toEqual(["1.1.1.0/24"]);
  });
});
