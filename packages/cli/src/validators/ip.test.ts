import { describe, it, expect } from "vitest";
import { isValidIp } from "./ip.js";

describe("isValidIp", () => {
  it("validates standard IPv4", () => {
    expect(isValidIp("1.2.3.4")).toBe(true);
    expect(isValidIp("203.0.113.42")).toBe(true);
    expect(isValidIp("255.255.255.255")).toBe(true);
    expect(isValidIp("0.0.0.0")).toBe(true);
  });

  it("rejects invalid IPv4", () => {
    expect(isValidIp("256.1.1.1")).toBe(false);
    expect(isValidIp("1.2.3")).toBe(false);
    expect(isValidIp("1.2.3.4.5")).toBe(false);
    expect(isValidIp("1.2.3.04")).toBe(false); // leading zero
  });

  it("validates IPv6", () => {
    expect(isValidIp("2001:db8::1")).toBe(true);
    expect(isValidIp("::1")).toBe(true);
    expect(isValidIp("fe80::1")).toBe(true);
    expect(isValidIp("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
    expect(isValidIp("::")).toBe(true);
  });

  it("validates IPv4-mapped IPv6", () => {
    expect(isValidIp("::ffff:192.0.2.1")).toBe(true);
    expect(isValidIp("::ffff:1.2.3.4")).toBe(true);
  });

  it("rejects garbage", () => {
    expect(isValidIp("not-an-ip")).toBe(false);
    expect(isValidIp("")).toBe(false);
    expect(isValidIp("abc")).toBe(false);
    expect(isValidIp("1234")).toBe(false);
  });

  it("rejects IP with port", () => {
    expect(isValidIp("1.2.3.4:8080")).toBe(false);
    expect(isValidIp("[::1]:443")).toBe(false);
  });

  it("rejects IP with surrounding brackets", () => {
    expect(isValidIp("[::1]")).toBe(false);
  });
});
