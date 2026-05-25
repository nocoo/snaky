import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lookupIp, lookupIps } from "./echo.js";

describe("lookupIp", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns IpInfo on successful response", async () => {
    const mockResponse = {
      ip: "1.2.3.4",
      location: {
        country: "China",
        countryCode: "CN",
        province: "Guangdong",
        city: "Shenzhen",
        isp: "China Telecom",
        asn: 4134,
        asOrg: "CHINANET-BACKBONE",
      },
    };

    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await lookupIp("1.2.3.4", "test-key");
    expect(result).toEqual({
      ip: "1.2.3.4",
      country: "China",
      countryCode: "CN",
      province: "Guangdong",
      city: "Shenzhen",
      isp: "China Telecom",
      asn: 4134,
      asOrg: "CHINANET-BACKBONE",
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://echo.nocoo.cloud/api/ip?ip=1.2.3.4",
      expect.objectContaining({
        headers: { "x-api-key": "test-key" },
      }),
    );
  });

  it("returns null on HTTP error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
    });

    const result = await lookupIp("1.2.3.4", "bad-key");
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    const result = await lookupIp("1.2.3.4", "test-key");
    expect(result).toBeNull();
  });

  it("handles missing location fields gracefully", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ ip: "5.6.7.8" }),
    });

    const result = await lookupIp("5.6.7.8", "test-key");
    expect(result).toEqual({
      ip: "5.6.7.8",
      country: null,
      countryCode: null,
      province: null,
      city: null,
      isp: null,
      asn: null,
      asOrg: null,
    });
  });
});

describe("lookupIps", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates IPs and returns map", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      const ip = new URL(url).searchParams.get("ip");
      return {
        ok: true,
        json: async () => ({
          ip,
          location: { country: "US", countryCode: "US", isp: "Cloudflare", asn: 13335 },
        }),
      };
    });

    const result = await lookupIps(["1.1.1.1", "1.1.1.1", "8.8.8.8"], "key");
    expect(result.size).toBe(2);
    expect(result.get("1.1.1.1")?.isp).toBe("Cloudflare");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("skips failed lookups", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

    const result = await lookupIps(["1.1.1.1"], "key");
    expect(result.size).toBe(0);
  });
});
