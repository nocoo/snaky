import { describe, expect, it } from "vitest";
import { formatDnsLeakTable } from "./output.js";
import type { DnsLeakOutput } from "./types.js";

describe("formatDnsLeakTable", () => {
  it("formats no_leak verdict", () => {
    const output: DnsLeakOutput = {
      token: "a1b2c3d4e5f6",
      rounds: 5,
      userIp: "104.28.12.34",
      userCountry: "United States",
      userCountryCode: "US",
      dnsServers: [
        {
          ip: "172.64.36.1",
          country: "United States",
          countryCode: "US",
          city: null,
          isp: "Cloudflare",
          asn: 13335,
          asOrg: "Cloudflare, Inc.",
          leaked: false,
        },
      ],
      count: 1,
      verdict: "no_leak",
    };

    const text = formatDnsLeakTable(output);
    expect(text).toContain("🛡️  DNS Leak Test");
    expect(text).toContain("Your IP: 104.28.12.34 (\x1b[36mUS\x1b[0m)");
    expect(text).toContain("172.64.36.1");
    expect(text).toContain("Cloudflare");
    expect(text).toContain("✓ OK");
    expect(text).toContain("✓ No DNS leak detected (1 resolver found)");
  });

  it("formats leak verdict", () => {
    const output: DnsLeakOutput = {
      token: "f7e8d9c0b1a2",
      rounds: 5,
      userIp: "104.28.12.34",
      userCountry: "United States",
      userCountryCode: "US",
      dnsServers: [
        {
          ip: "172.64.36.1",
          country: "United States",
          countryCode: "US",
          city: null,
          isp: "Cloudflare",
          asn: 13335,
          asOrg: null,
          leaked: false,
        },
        {
          ip: "114.114.114.114",
          country: "China",
          countryCode: "CN",
          city: "Nanjing",
          isp: "China Unicom",
          asn: 4837,
          asOrg: null,
          leaked: true,
        },
      ],
      count: 2,
      verdict: "leak",
    };

    const text = formatDnsLeakTable(output);
    expect(text).toContain("⚠ LEAK");
    expect(text).toContain("✓ OK");
    expect(text).toContain("⚠ DNS leak detected! 1 of 2 resolvers may be leaking");
  });

  it("formats inconclusive with no resolvers", () => {
    const output: DnsLeakOutput = {
      token: "deadbeef1234",
      rounds: 5,
      userIp: null,
      userCountry: null,
      userCountryCode: null,
      dnsServers: [],
      count: 0,
      verdict: "inconclusive",
    };

    const text = formatDnsLeakTable(output);
    expect(text).toContain("🛡️  DNS Leak Test");
    expect(text).toContain("No DNS resolvers detected");
    expect(text).toContain("Unable to determine leak status.");
    expect(text).not.toContain("Your IP:");
  });

  it("formats inconclusive with resolvers but no geo", () => {
    const output: DnsLeakOutput = {
      token: "abcdef123456",
      rounds: 3,
      userIp: "1.2.3.4",
      userCountry: null,
      userCountryCode: "US",
      dnsServers: [
        {
          ip: "8.8.8.8",
          country: null,
          countryCode: null,
          city: null,
          isp: null,
          asn: null,
          asOrg: null,
          leaked: false,
        },
      ],
      count: 1,
      verdict: "inconclusive",
    };

    const text = formatDnsLeakTable(output);
    expect(text).toContain("8.8.8.8");
    expect(text).toContain("Unknown");
    expect(text).toContain("Unable to determine leak status.");
  });

  it("pluralizes resolvers correctly", () => {
    const output: DnsLeakOutput = {
      token: "aabbccddee11",
      rounds: 5,
      userIp: "1.2.3.4",
      userCountry: null,
      userCountryCode: "US",
      dnsServers: [
        { ip: "8.8.8.8", country: "US", countryCode: "US", city: null, isp: "Google", asn: 15169, asOrg: null, leaked: false },
        { ip: "8.8.4.4", country: "US", countryCode: "US", city: null, isp: "Google", asn: 15169, asOrg: null, leaked: false },
      ],
      count: 2,
      verdict: "no_leak",
    };

    const text = formatDnsLeakTable(output);
    expect(text).toContain("2 resolvers found");
  });

  it("noColor suppresses ANSI escape sequences", () => {
    const output: DnsLeakOutput = {
      token: "a1b2c3d4e5f6",
      rounds: 5,
      userIp: "104.28.12.34",
      userCountry: "United States",
      userCountryCode: "US",
      dnsServers: [
        { ip: "172.64.36.1", country: "US", countryCode: "US", city: null, isp: "Cloudflare", asn: 13335, asOrg: null, leaked: false },
      ],
      count: 1,
      verdict: "no_leak",
    };

    const text = formatDnsLeakTable(output, { noColor: true });
    // biome-ignore lint/suspicious/noControlCharactersInRegex: intentionally testing for ANSI escapes
    expect(text).not.toMatch(/\x1b\[/);
    expect(text).toContain("US");
  });
});
