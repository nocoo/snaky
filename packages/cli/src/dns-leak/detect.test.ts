import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateToken, runDnsLeakDetection } from "./detect.js";

vi.mock("node:dns", () => ({
  promises: {
    lookup: vi.fn().mockResolvedValue({ address: "10.255.255.1", family: 4 }),
  },
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function advanceTimersWhileRunning<T>(promise: Promise<T>): Promise<T> {
  const tick = async () => {
    while (true) {
      await vi.advanceTimersByTimeAsync(100);
      await Promise.resolve();
    }
  };
  return Promise.race([promise, tick()]) as Promise<T>;
}

function makeFetch(responses: Record<string, { status: number; body: unknown }>) {
  return (async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, resp] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: resp.status >= 200 && resp.status < 300,
          status: resp.status,
          json: async () => resp.body,
          text: async () =>
            typeof resp.body === "string" ? resp.body : JSON.stringify(resp.body),
        } as Response;
      }
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" } as unknown as Response;
  }) as unknown as typeof fetch;
}

describe("generateToken", () => {
  it("returns 12-char hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{12}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("runDnsLeakDetection", () => {
  it("returns inconclusive when no resolvers found and no API key", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": {
        status: 200,
        body: "ip=1.2.3.4\nloc=US\n",
      },
      "/result/": {
        status: 200,
        body: { dns_servers: [] },
      },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, fetchFn }),
    );

    expect(output.verdict).toBe("inconclusive");
    expect(output.count).toBe(0);
    expect(output.userIp).toBe("1.2.3.4");
    expect(output.userCountryCode).toBe("US");
    expect(exitCode).toBe(2);
  });

  it("returns no_leak when resolvers match expectedResolvers CIDR", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": {
        status: 200,
        body: "ip=1.2.3.4\nloc=US\n",
      },
      "/result/": {
        status: 200,
        body: { dns_servers: ["172.64.36.1", "172.64.36.2"] },
      },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, expectedResolvers: ["172.64.0.0/16"], fetchFn }),
    );

    expect(output.verdict).toBe("no_leak");
    expect(output.dnsServers.every((s) => !s.leaked)).toBe(true);
    expect(exitCode).toBe(0);
  });

  it("returns leak when resolver IP outside expectedResolvers", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": {
        status: 200,
        body: "ip=1.2.3.4\nloc=US\n",
      },
      "/result/": {
        status: 200,
        body: { dns_servers: ["172.64.36.1", "114.114.114.114"] },
      },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, expectedResolvers: ["172.64.0.0/16"], fetchFn }),
    );

    expect(output.verdict).toBe("leak");
    expect(exitCode).toBe(1);
    const leaked = output.dnsServers.find((s) => s.ip === "114.114.114.114");
    expect(leaked?.leaked).toBe(true);
    const ok = output.dnsServers.find((s) => s.ip === "172.64.36.1");
    expect(ok?.leaked).toBe(false);
  });

  it("returns no_leak via geo comparison when countries match", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": {
        status: 200,
        body: "ip=104.28.12.34\nloc=US\n",
      },
      "/result/": {
        status: 200,
        body: { dns_servers: ["172.64.36.1"] },
      },
      "echo.nocoo.cloud/api/ip": {
        status: 200,
        body: {
          ip: "172.64.36.1",
          location: { country: "United States", countryCode: "US", isp: "Cloudflare", asn: 13335 },
        },
      },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, echoApiKey: "test-key", fetchFn }),
    );

    expect(output.verdict).toBe("no_leak");
    expect(exitCode).toBe(0);
    expect(output.dnsServers[0]?.isp).toBe("Cloudflare");
  });

  it("returns leak via geo comparison when countries differ", async () => {
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("cdn-cgi/trace")) {
        return {
          ok: true, status: 200,
          text: async () => "ip=104.28.12.34\nloc=US\n",
          json: async () => ({}),
        } as Response;
      }
      if (url.includes("/result/")) {
        return {
          ok: true, status: 200,
          json: async () => ({ dns_servers: ["114.114.114.114"] }),
          text: async () => "",
        } as Response;
      }
      if (url.includes("echo.nocoo.cloud/api/ip")) {
        if (url.includes("104.28.12.34")) {
          return {
            ok: true, status: 200,
            json: async () => ({
              ip: "104.28.12.34",
              location: { country: "United States", countryCode: "US" },
            }),
            text: async () => "",
          } as Response;
        }
        return {
          ok: true, status: 200,
          json: async () => ({
            ip: "114.114.114.114",
            location: { country: "China", countryCode: "CN", city: "Nanjing", isp: "China Unicom", asn: 4837 },
          }),
          text: async () => "",
        } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}), text: async () => "" } as unknown as Response;
    }) as unknown as typeof fetch;

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, echoApiKey: "test-key", fetchFn }),
    );

    expect(output.verdict).toBe("leak");
    expect(exitCode).toBe(1);
    expect(output.dnsServers[0]?.leaked).toBe(true);
    expect(output.dnsServers[0]?.countryCode).toBe("CN");
  });

  it("returns inconclusive when cftrace fails", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": { status: 500, body: "" },
      "/result/": { status: 200, body: { dns_servers: ["8.8.8.8"] } },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, echoApiKey: "test-key", fetchFn }),
    );

    expect(output.verdict).toBe("inconclusive");
    expect(output.userIp).toBeNull();
    expect(exitCode).toBe(2);
  });

  it("returns inconclusive when has resolvers but no API key and no expectedResolvers", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": { status: 200, body: "ip=1.2.3.4\nloc=US\n" },
      "/result/": { status: 200, body: { dns_servers: ["8.8.8.8"] } },
    });

    const { output, exitCode } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, fetchFn }),
    );

    expect(output.verdict).toBe("inconclusive");
    expect(output.count).toBe(1);
    expect(exitCode).toBe(2);
  });

  it("populates token and rounds in output", async () => {
    const fetchFn = makeFetch({
      "cdn-cgi/trace": { status: 200, body: "ip=1.2.3.4\nloc=US\n" },
      "/result/": { status: 200, body: { dns_servers: [] } },
    });

    const { output } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 3, fetchFn }),
    );

    expect(output.token).toMatch(/^[0-9a-f]{12}$/);
    expect(output.rounds).toBe(3);
  });

  it("enriches user IP country when API key available", async () => {
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("cdn-cgi/trace")) {
        return { ok: true, status: 200, text: async () => "ip=1.2.3.4\nloc=US\n" } as Response;
      }
      if (url.includes("echo.nocoo.cloud/api/ip") && url.includes("1.2.3.4")) {
        return {
          ok: true, status: 200,
          json: async () => ({ ip: "1.2.3.4", location: { country: "United States", countryCode: "US" } }),
        } as Response;
      }
      if (url.includes("/result/")) {
        return { ok: true, status: 200, json: async () => ({ dns_servers: [] }) } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as unknown as typeof fetch;

    const { output } = await advanceTimersWhileRunning(
      runDnsLeakDetection({ rounds: 1, echoApiKey: "key", fetchFn }),
    );

    expect(output.userCountry).toBe("United States");
  });
});
