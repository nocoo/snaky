import { describe, expect, it } from "vitest";
import { extractIpFromHeaders } from "./http-header.js";

function makeHeaders(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("extractIpFromHeaders", () => {
  it("extracts valid IPv4 from first matching header", () => {
    const headers = makeHeaders({ "cdn-user-ip": "203.0.113.42" });
    const result = extractIpFromHeaders(headers, ["cdn-user-ip"]);
    expect(result).toEqual({ ok: true, ip: "203.0.113.42" });
  });

  it("extracts valid IPv6", () => {
    const headers = makeHeaders({ "x-real-ip": "2001:db8::1" });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({ ok: true, ip: "2001:db8::1" });
  });

  it("extracts full IPv6 address", () => {
    const headers = makeHeaders({
      "x-real-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({
      ok: true,
      ip: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
    });
  });

  it("checks headers in order, first non-empty wins", () => {
    const headers = makeHeaders({
      "x-request-ip": "10.0.0.1",
      "x-response-cinfo": "10.0.0.2",
    });
    const result = extractIpFromHeaders(headers, [
      "x-request-ip",
      "x-response-cinfo",
    ]);
    expect(result).toEqual({ ok: true, ip: "10.0.0.1" });
  });

  it("falls back to second header if first is missing", () => {
    const headers = makeHeaders({ "x-response-cinfo": "10.0.0.2" });
    const result = extractIpFromHeaders(headers, [
      "x-request-ip",
      "x-response-cinfo",
    ]);
    expect(result).toEqual({ ok: true, ip: "10.0.0.2" });
  });

  it("trims whitespace from header value", () => {
    const headers = makeHeaders({ "x-real-ip": "  1.2.3.4  " });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({ ok: true, ip: "1.2.3.4" });
  });

  it("returns HEADER_MISSING when no specified headers present", () => {
    const headers = makeHeaders({ "content-type": "text/html" });
    const result = extractIpFromHeaders(headers, ["x-real-ip", "cdn-user-ip"]);
    expect(result).toEqual({
      ok: false,
      code: "HEADER_MISSING",
      message: "None of the expected headers found: x-real-ip, cdn-user-ip",
    });
  });

  it("returns HEADER_MISSING for empty header value", () => {
    const headers = makeHeaders({ "x-real-ip": "" });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({
      ok: false,
      code: "HEADER_MISSING",
      message: "None of the expected headers found: x-real-ip",
    });
  });

  it("returns PARSE_ERROR for comma-separated IPs", () => {
    const headers = makeHeaders({ "x-real-ip": "1.2.3.4, 5.6.7.8" });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message:
        "Invalid IP format in header x-real-ip: contains multiple values",
    });
  });

  it("returns PARSE_ERROR for IP with port", () => {
    const headers = makeHeaders({ "x-real-ip": "1.2.3.4:8080" });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message: "Invalid IP format in header x-real-ip: not a valid IP literal",
    });
  });

  it("returns PARSE_ERROR for garbage value", () => {
    const headers = makeHeaders({ "x-real-ip": "not-an-ip" });
    const result = extractIpFromHeaders(headers, ["x-real-ip"]);
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message: "Invalid IP format in header x-real-ip: not a valid IP literal",
    });
  });
});
