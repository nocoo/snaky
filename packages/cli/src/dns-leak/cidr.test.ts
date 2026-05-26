import { describe, expect, it } from "vitest";
import { matchesAnyCidr, matchesCidr } from "./cidr.js";

describe("matchesCidr", () => {
  it("matches exact IP (implicit /32)", () => {
    expect(matchesCidr("1.1.1.1", "1.1.1.1")).toBe(true);
    expect(matchesCidr("1.1.1.2", "1.1.1.1")).toBe(false);
  });

  it("matches /32 explicit", () => {
    expect(matchesCidr("8.8.8.8", "8.8.8.8/32")).toBe(true);
    expect(matchesCidr("8.8.8.9", "8.8.8.8/32")).toBe(false);
  });

  it("matches /24", () => {
    expect(matchesCidr("172.64.36.1", "172.64.36.0/24")).toBe(true);
    expect(matchesCidr("172.64.36.255", "172.64.36.0/24")).toBe(true);
    expect(matchesCidr("172.64.37.0", "172.64.36.0/24")).toBe(false);
  });

  it("matches /16", () => {
    expect(matchesCidr("172.64.0.1", "172.64.0.0/16")).toBe(true);
    expect(matchesCidr("172.64.255.255", "172.64.0.0/16")).toBe(true);
    expect(matchesCidr("172.65.0.0", "172.64.0.0/16")).toBe(false);
  });

  it("matches /8", () => {
    expect(matchesCidr("10.0.0.1", "10.0.0.0/8")).toBe(true);
    expect(matchesCidr("10.255.255.255", "10.0.0.0/8")).toBe(true);
    expect(matchesCidr("11.0.0.0", "10.0.0.0/8")).toBe(false);
  });

  it("returns false for invalid CIDR", () => {
    expect(matchesCidr("1.1.1.1", "not-a-cidr")).toBe(false);
    expect(matchesCidr("1.1.1.1", "999.999.999.999/24")).toBe(false);
    expect(matchesCidr("1.1.1.1", "1.1.1.1/33")).toBe(false);
  });

  it("returns false for invalid IP", () => {
    expect(matchesCidr("not-an-ip", "1.1.1.0/24")).toBe(false);
    expect(matchesCidr("", "1.1.1.0/24")).toBe(false);
  });
});

describe("matchesAnyCidr", () => {
  it("returns true if any CIDR matches", () => {
    expect(matchesAnyCidr("172.64.36.1", ["1.1.1.0/24", "172.64.0.0/16"])).toBe(true);
  });

  it("returns false if no CIDR matches", () => {
    expect(matchesAnyCidr("8.8.8.8", ["1.1.1.0/24", "172.64.0.0/16"])).toBe(false);
  });

  it("returns false for empty CIDR list", () => {
    expect(matchesAnyCidr("1.1.1.1", [])).toBe(false);
  });
});
