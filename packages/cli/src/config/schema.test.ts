import { describe, expect, it } from "vitest";
import { validateConfig } from "./schema.js";

describe("validateConfig", () => {
  it("accepts a valid config", () => {
    const raw = {
      endpoints: [
        { name: "custom", method: "cftrace", domain: "example.com" },
      ],
      pingTargets: [
        { name: "my-ping", url: "https://example.com/health", tag: "custom" },
      ],
      timeout: 5000,
      concurrency: 10,
    };
    const result = validateConfig(raw);
    expect(result.ok).toBe(true);
  });

  it("accepts empty config (all defaults)", () => {
    const result = validateConfig({});
    expect(result.ok).toBe(true);
  });

  it("rejects invalid endpoint name (uppercase)", () => {
    const result = validateConfig({
      endpoints: [{ name: "MyEndpoint", method: "cftrace", domain: "x.com" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors[0]).toMatch(/name.*MyEndpoint/i);
  });

  it("rejects invalid endpoint name (starts with dash)", () => {
    const result = validateConfig({
      endpoints: [{ name: "-bad", method: "cftrace", domain: "x.com" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid endpoint name (too long)", () => {
    const name = "a".repeat(64);
    const result = validateConfig({
      endpoints: [{ name, method: "cftrace", domain: "x.com" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate endpoint names", () => {
    const result = validateConfig({
      endpoints: [
        { name: "dup", method: "cftrace", domain: "a.com" },
        { name: "dup", method: "cftrace", domain: "b.com" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/duplicate/i);
  });

  it("rejects duplicate names across endpoints and pingTargets", () => {
    const result = validateConfig({
      endpoints: [{ name: "samename", method: "cftrace", domain: "a.com" }],
      pingTargets: [
        { name: "samename", url: "https://a.com/h", tag: "test" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/duplicate/i);
  });

  it("rejects timeout out of range", () => {
    expect(validateConfig({ timeout: 50 }).ok).toBe(false);
    expect(validateConfig({ timeout: 70000 }).ok).toBe(false);
    expect(validateConfig({ timeout: 0 }).ok).toBe(false);
    expect(validateConfig({ timeout: -1 }).ok).toBe(false);
  });

  it("rejects non-integer timeout", () => {
    expect(validateConfig({ timeout: 5000.5 }).ok).toBe(false);
  });

  it("rejects pingTimeout out of range", () => {
    expect(validateConfig({ pingTimeout: 50 }).ok).toBe(false);
    expect(validateConfig({ pingTimeout: 20000 }).ok).toBe(false);
  });

  it("rejects concurrency out of range", () => {
    expect(validateConfig({ concurrency: 0 }).ok).toBe(false);
    expect(validateConfig({ concurrency: 21 }).ok).toBe(false);
  });

  it("rejects retries out of range", () => {
    expect(validateConfig({ retries: -1 }).ok).toBe(false);
    expect(validateConfig({ retries: 6 }).ok).toBe(false);
  });

  it("rejects pingRounds out of range", () => {
    expect(validateConfig({ pingRounds: 0 }).ok).toBe(false);
    expect(validateConfig({ pingRounds: 31 }).ok).toBe(false);
  });

  it("rejects invalid method value", () => {
    const result = validateConfig({
      endpoints: [{ name: "bad", method: "icmp", domain: "x.com" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects http-header without headers array", () => {
    const result = validateConfig({
      endpoints: [
        { name: "bad", method: "http-header", url: "https://x.com/check" },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects http-header with empty headers array", () => {
    const result = validateConfig({
      endpoints: [
        {
          name: "bad",
          method: "http-header",
          url: "https://x.com/check",
          headers: [],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts disabled endpoint without method/domain (tombstone)", () => {
    const result = validateConfig({
      endpoints: [{ name: "openai", disabled: true }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects cftrace endpoint missing domain when not disabled", () => {
    const result = validateConfig({
      endpoints: [{ name: "bad", method: "cftrace" }],
    });
    expect(result.ok).toBe(false);
  });

  it("reports unknown top-level keys as warnings (still valid)", () => {
    const result = validateConfig({
      unknownKey: "value",
      anotherUnknown: 123,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContain("Unknown config key: unknownKey");
      expect(result.warnings).toContain("Unknown config key: anotherUnknown");
    }
  });

  it("rejects http-header endpoint with non-HTTPS url", () => {
    const result = validateConfig({
      endpoints: [
        {
          name: "bad",
          method: "http-header",
          url: "http://x.com/check",
          headers: ["x-ip"],
        },
      ],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid name patterns", () => {
    const names = ["a", "abc-def", "my.endpoint", "test_1", "a0b"];
    for (const name of names) {
      const result = validateConfig({
        endpoints: [{ name, method: "cftrace", domain: "x.com" }],
      });
      expect(result.ok, `name "${name}" should be valid`).toBe(true);
    }
  });

  it("rejects endpoint missing name", () => {
    const result = validateConfig({
      endpoints: [{ method: "cftrace", domain: "x.com" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects ping target missing name", () => {
    const result = validateConfig({
      pingTargets: [{ url: "https://x.com/h", tag: "test" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects ping target with invalid name", () => {
    const result = validateConfig({
      pingTargets: [{ name: "INVALID", url: "https://x.com/h", tag: "test" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects ping target missing url when not disabled", () => {
    const result = validateConfig({
      pingTargets: [{ name: "test", tag: "test" }],
    });
    expect(result.ok).toBe(false);
  });

  it("rejects ping target with non-HTTPS url", () => {
    const result = validateConfig({
      pingTargets: [{ name: "test", url: "http://x.com/h", tag: "test" }],
    });
    expect(result.ok).toBe(false);
  });

  it("accepts disabled ping target without url", () => {
    const result = validateConfig({
      pingTargets: [{ name: "test", disabled: true }],
    });
    expect(result.ok).toBe(true);
  });

  it("rejects cftrace domain with explicit port", () => {
    const result = validateConfig({
      endpoints: [{ name: "test", method: "cftrace", domain: "example.com:8443" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/port/i);
  });

  it("rejects cftrace domain with scheme", () => {
    const result = validateConfig({
      endpoints: [{ name: "test", method: "cftrace", domain: "https://example.com" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/scheme/i);
  });

  it("rejects cftrace domain with path", () => {
    const result = validateConfig({
      endpoints: [{ name: "test", method: "cftrace", domain: "example.com/cdn-cgi" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/path/i);
  });

  it("rejects invalid domain format", () => {
    const result = validateConfig({
      endpoints: [{ name: "test", method: "cftrace", domain: "not a domain" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid domain/i);
  });

  it("rejects invalid header name (spaces)", () => {
    const result = validateConfig({
      endpoints: [
        { name: "test", method: "http-header", url: "https://x.com/check", headers: ["bad header"] },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid header name/i);
  });

  it("rejects invalid header name (special chars)", () => {
    const result = validateConfig({
      endpoints: [
        { name: "test", method: "http-header", url: "https://x.com/check", headers: ["bad(header)"] },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid header name/i);
  });

  it("accepts valid header names (x-forwarded-for, cdn-user-ip)", () => {
    const result = validateConfig({
      endpoints: [
        { name: "test", method: "http-header", url: "https://x.com/check", headers: ["x-forwarded-for", "cdn-user-ip"] },
      ],
    });
    expect(result.ok).toBe(true);
  });
});
