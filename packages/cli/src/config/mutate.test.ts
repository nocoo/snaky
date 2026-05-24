import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addEndpoint,
  disableEndpoint,
  enableEndpoint,
  removeEndpoint,
} from "./mutate.js";

describe("config mutation", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaky-mutate-"));
    configPath = join(dir, "config.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function readConfig() {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  }

  describe("addEndpoint", () => {
    it("adds a cftrace endpoint", () => {
      const result = addEndpoint(configPath, {
        name: "test",
        method: "cftrace",
        domain: "test.com",
      });
      expect(result.ok).toBe(true);
      const config = readConfig();
      expect(config.endpoints).toHaveLength(1);
      expect(config.endpoints[0].name).toBe("test");
      expect(config.endpoints[0].domain).toBe("test.com");
    });

    it("adds an http-header endpoint", () => {
      const result = addEndpoint(configPath, {
        name: "my-check",
        method: "http-header",
        url: "https://example.com/check",
        headers: ["x-real-ip"],
      });
      expect(result.ok).toBe(true);
      const config = readConfig();
      expect(config.endpoints[0].method).toBe("http-header");
      expect(config.endpoints[0].headers).toEqual(["x-real-ip"]);
    });

    it("adds an http-ping target to pingTargets", () => {
      const result = addEndpoint(configPath, {
        name: "my-ping",
        method: "http-ping",
        url: "https://example.com/health",
      });
      expect(result.ok).toBe(true);
      const config = readConfig();
      expect(config.pingTargets).toHaveLength(1);
      expect(config.pingTargets[0].name).toBe("my-ping");
    });

    it("creates config file if not exists", () => {
      addEndpoint(configPath, {
        name: "new",
        method: "cftrace",
        domain: "new.com",
      });
      expect(readConfig().endpoints).toHaveLength(1);
    });

    it("appends to existing config", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "existing", method: "cftrace", domain: "a.com" }],
        }),
      );
      addEndpoint(configPath, {
        name: "new",
        method: "cftrace",
        domain: "b.com",
      });
      expect(readConfig().endpoints).toHaveLength(2);
    });

    it("rejects duplicate name", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "dup", method: "cftrace", domain: "a.com" }],
        }),
      );
      const result = addEndpoint(configPath, {
        name: "dup",
        method: "cftrace",
        domain: "b.com",
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("removeEndpoint", () => {
    it("removes a user-added endpoint", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "custom", method: "cftrace", domain: "x.com" }],
        }),
      );
      const result = removeEndpoint(configPath, "custom");
      expect(result.ok).toBe(true);
      expect(readConfig().endpoints).toHaveLength(0);
    });

    it("removes user override — built-in resurfaces", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [
            { name: "openai", method: "cftrace", domain: "custom.com" },
          ],
        }),
      );
      const result = removeEndpoint(configPath, "openai");
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.message).toMatch(/built-in resurfaces/i);
    });

    it("errors on removing pure built-in", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = removeEndpoint(configPath, "anthropic");
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(result.error).toMatch(/cannot remove built-in/i);
    });

    it("errors on non-existent endpoint", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = removeEndpoint(configPath, "nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/not found/i);
    });

    it("removes from pingTargets", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          pingTargets: [
            { name: "my-ping", url: "https://x.com/h", tag: "test" },
          ],
        }),
      );
      const result = removeEndpoint(configPath, "my-ping");
      expect(result.ok).toBe(true);
      expect(readConfig().pingTargets).toHaveLength(0);
    });
  });

  describe("disableEndpoint", () => {
    it("disables a built-in by adding tombstone", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = disableEndpoint(configPath, "openai");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.endpoints.find(
        (e: { name: string }) => e.name === "openai",
      );
      expect(entry).toEqual({ name: "openai", disabled: true });
    });

    it("disables a user endpoint preserving config", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "custom", method: "cftrace", domain: "x.com" }],
        }),
      );
      const result = disableEndpoint(configPath, "custom");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.endpoints.find(
        (e: { name: string }) => e.name === "custom",
      );
      expect(entry.disabled).toBe(true);
      expect(entry.domain).toBe("x.com");
    });

    it("is idempotent on already-disabled", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "openai", disabled: true }],
        }),
      );
      const result = disableEndpoint(configPath, "openai");
      expect(result.ok).toBe(true);
    });

    it("errors on non-existent endpoint", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = disableEndpoint(configPath, "nonexistent");
      expect(result.ok).toBe(false);
    });

    it("disables a built-in ping target by adding tombstone", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = disableEndpoint(configPath, "ping-github");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.pingTargets.find(
        (p: { name: string }) => p.name === "ping-github",
      );
      expect(entry).toEqual({ name: "ping-github", disabled: true });
    });

    it("disables a user ping target preserving config", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          pingTargets: [{ name: "my-ping", url: "https://x.com/h", tag: "test" }],
        }),
      );
      const result = disableEndpoint(configPath, "my-ping");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.pingTargets.find(
        (p: { name: string }) => p.name === "my-ping",
      );
      expect(entry.disabled).toBe(true);
      expect(entry.url).toBe("https://x.com/h");
    });
  });

  describe("enableEndpoint", () => {
    it("enables a tombstone (removes it, built-in resurfaces)", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "openai", disabled: true }],
        }),
      );
      const result = enableEndpoint(configPath, "openai");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.endpoints?.find(
        (e: { name: string }) => e.name === "openai",
      );
      expect(entry).toBeUndefined();
    });

    it("enables a user endpoint (removes disabled flag)", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [
            {
              name: "custom",
              method: "cftrace",
              domain: "x.com",
              disabled: true,
            },
          ],
        }),
      );
      const result = enableEndpoint(configPath, "custom");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.endpoints.find(
        (e: { name: string }) => e.name === "custom",
      );
      expect(entry.disabled).toBeUndefined();
      expect(entry.domain).toBe("x.com");
    });

    it("is idempotent on already-enabled", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          endpoints: [{ name: "custom", method: "cftrace", domain: "x.com" }],
        }),
      );
      const result = enableEndpoint(configPath, "custom");
      expect(result.ok).toBe(true);
    });

    it("errors on non-existent endpoint", () => {
      writeFileSync(configPath, JSON.stringify({}));
      const result = enableEndpoint(configPath, "nonexistent");
      expect(result.ok).toBe(false);
    });

    it("enables a disabled ping target tombstone (removes it)", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          pingTargets: [{ name: "ping-github", disabled: true }],
        }),
      );
      const result = enableEndpoint(configPath, "ping-github");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.pingTargets?.find(
        (p: { name: string }) => p.name === "ping-github",
      );
      expect(entry).toBeUndefined();
    });

    it("enables a user ping target (removes disabled flag)", () => {
      writeFileSync(
        configPath,
        JSON.stringify({
          pingTargets: [{ name: "my-ping", url: "https://x.com/h", tag: "test", disabled: true }],
        }),
      );
      const result = enableEndpoint(configPath, "my-ping");
      expect(result.ok).toBe(true);
      const config = readConfig();
      const entry = config.pingTargets.find(
        (p: { name: string }) => p.name === "my-ping",
      );
      expect(entry.disabled).toBeUndefined();
      expect(entry.url).toBe("https://x.com/h");
    });
  });
});
