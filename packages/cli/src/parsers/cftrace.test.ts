import { describe, expect, it } from "vitest";
import { parseCfTrace } from "./cftrace.js";

describe("parseCfTrace", () => {
  it("parses a valid cftrace response", () => {
    const body = [
      "fl=123f456",
      "h=example.com",
      "ip=203.0.113.42",
      "ts=1234567890.123",
      "visit_scheme=https",
      "uag=curl/7.68.0",
      "colo=HKG",
      "sliver=none",
      "http=http/2",
      "loc=HK",
      "tls=TLSv1.3",
      "sni=plaintext",
      "warp=off",
      "gateway=off",
      "rbi=off",
      "kex=X25519",
    ].join("\n");

    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: true,
      ip: "203.0.113.42",
      location: "HK",
      colo: "HKG",
    });
  });

  it("parses response with IPv6", () => {
    const body = "ip=2001:db8::1\nloc=US\ncolo=LAX\n";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: true,
      ip: "2001:db8::1",
      location: "US",
      colo: "LAX",
    });
  });

  it("returns partial result when only ip is present", () => {
    const body = "ip=203.0.113.42\nother=value\n";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: true,
      ip: "203.0.113.42",
      location: null,
      colo: null,
    });
  });

  it("returns PARSE_ERROR for empty body", () => {
    const result = parseCfTrace("");
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message: "Empty response body",
    });
  });

  it("returns PARSE_ERROR for missing ip field", () => {
    const body = "loc=HK\ncolo=HKG\nother=value\n";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message: "Missing ip field in cftrace response",
    });
  });

  it("returns PARSE_ERROR for garbage input", () => {
    const body = "this is not a key=value format at all!!!";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: false,
      code: "PARSE_ERROR",
      message: "Missing ip field in cftrace response",
    });
  });

  it("handles Windows-style line endings", () => {
    const body = "ip=1.2.3.4\r\nloc=JP\r\ncolo=NRT\r\n";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: true,
      ip: "1.2.3.4",
      location: "JP",
      colo: "NRT",
    });
  });

  it("trims whitespace from values", () => {
    const body = "ip= 10.0.0.1 \nloc= CN \ncolo= PEK \n";
    const result = parseCfTrace(body);
    expect(result).toEqual({
      ok: true,
      ip: "10.0.0.1",
      location: "CN",
      colo: "PEK",
    });
  });
});
