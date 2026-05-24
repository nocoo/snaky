import { describe, it, expect } from "vitest";
import { normalizeDomain } from "./normalize.js";

describe("normalizeDomain", () => {
  it("accepts bare domain", () => {
    expect(normalizeDomain("openai.com")).toEqual({
      ok: true,
      domain: "openai.com",
    });
  });

  it("accepts subdomain", () => {
    expect(normalizeDomain("www.cloudflare.com")).toEqual({
      ok: true,
      domain: "www.cloudflare.com",
    });
  });

  it("strips https:// scheme", () => {
    expect(normalizeDomain("https://openai.com")).toEqual({
      ok: true,
      domain: "openai.com",
    });
  });

  it("strips http:// scheme and normalizes", () => {
    expect(normalizeDomain("http://openai.com")).toEqual({
      ok: true,
      domain: "openai.com",
    });
  });

  it("strips path from URL", () => {
    expect(normalizeDomain("https://openai.com/cdn-cgi/trace")).toEqual({
      ok: true,
      domain: "openai.com",
    });
  });

  it("strips trailing slashes", () => {
    expect(normalizeDomain("openai.com/")).toEqual({
      ok: true,
      domain: "openai.com",
    });
    expect(normalizeDomain("https://openai.com/")).toEqual({
      ok: true,
      domain: "openai.com",
    });
  });

  it("rejects ftp:// scheme", () => {
    const result = normalizeDomain("ftp://openai.com");
    expect(result).toEqual({
      ok: false,
      message: "Unsupported scheme: ftp. Only HTTP(S) domains are accepted.",
    });
  });

  it("rejects file:// scheme", () => {
    const result = normalizeDomain("file:///etc/passwd");
    expect(result).toEqual({
      ok: false,
      message: "Unsupported scheme: file. Only HTTP(S) domains are accepted.",
    });
  });

  it("rejects domain with explicit port", () => {
    const result = normalizeDomain("example.com:8443");
    expect(result).toEqual({
      ok: false,
      message:
        "Custom ports not supported. Probe always uses HTTPS (port 443).",
    });
  });

  it("rejects URL with explicit port", () => {
    const result = normalizeDomain("https://example.com:8443/");
    expect(result).toEqual({
      ok: false,
      message:
        "Custom ports not supported. Probe always uses HTTPS (port 443).",
    });
  });

  it("rejects empty input", () => {
    const result = normalizeDomain("");
    expect(result).toEqual({
      ok: false,
      message: "Domain cannot be empty",
    });
  });

  it("rejects whitespace-only input", () => {
    const result = normalizeDomain("   ");
    expect(result).toEqual({
      ok: false,
      message: "Domain cannot be empty",
    });
  });
});
