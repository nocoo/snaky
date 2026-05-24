import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeCftrace } from "./cftrace.js";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost`);

    if (url.pathname === "/cdn-cgi/trace") {
      if (url.searchParams.get("delay")) {
        const delay = parseInt(url.searchParams.get("delay")!, 10);
        setTimeout(() => {
          res.writeHead(200);
          res.end("ip=1.2.3.4\nloc=US\ncolo=LAX\n");
        }, delay);
        return;
      }
      res.writeHead(200);
      res.end("ip=203.0.113.42\nloc=HK\ncolo=HKG\n");
      return;
    }

    if (url.pathname === "/cdn-cgi/trace-empty") {
      res.writeHead(200);
      res.end("");
      return;
    }

    if (url.pathname === "/cdn-cgi/trace-redirect") {
      res.writeHead(301, { location: "https://other.com/cdn-cgi/trace" });
      res.end();
      return;
    }

    if (url.pathname === "/cdn-cgi/trace-500") {
      res.writeHead(500);
      res.end("Internal Server Error");
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") port = addr.port;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe("probeCftrace", () => {
  it("returns parsed result for valid response", async () => {
    const result = await probeCftrace(`http://127.0.0.1:${port}`, {
      timeout: 5000,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ip).toBe("203.0.113.42");
      expect(result.location).toBe("HK");
      expect(result.colo).toBe("HKG");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns PARSE_ERROR for empty body", async () => {
    const result = await probeCftrace(
      `http://127.0.0.1:${port}`,
      { timeout: 5000 },
      "/cdn-cgi/trace-empty",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("PARSE_ERROR");
      expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns TIMEOUT for slow response", async () => {
    const result = await probeCftrace(
      `http://127.0.0.1:${port}`,
      { timeout: 50 },
      "/cdn-cgi/trace?delay=200",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("TIMEOUT");
    }
  });

  it("returns HTTP_ERROR for non-2xx", async () => {
    const result = await probeCftrace(
      `http://127.0.0.1:${port}`,
      { timeout: 5000 },
      "/cdn-cgi/trace-500",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("HTTP_ERROR");
      expect(result.message).toContain("500");
    }
  });

  it("returns REDIRECT for 3xx", async () => {
    const result = await probeCftrace(
      `http://127.0.0.1:${port}`,
      { timeout: 5000 },
      "/cdn-cgi/trace-redirect",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REDIRECT");
    }
  });

  it("returns DNS_FAILED for unresolvable host", async () => {
    const result = await probeCftrace(
      "http://this-domain-does-not-exist-12345.invalid",
      { timeout: 5000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DNS_FAILED");
      expect(result.responseTimeMs).toBeNull();
    }
  });

  it("returns CONNECTION_REFUSED for closed port", async () => {
    const result = await probeCftrace("http://127.0.0.1:19999", {
      timeout: 5000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CONNECTION_REFUSED");
      expect(result.responseTimeMs).toBeNull();
    }
  });
});
