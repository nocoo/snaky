import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeHttpHeader } from "./http-header.js";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);

    if (url.pathname === "/valid-ip") {
      res.writeHead(200, { "cdn-user-ip": "10.0.0.1" });
      res.end();
      return;
    }

    if (url.pathname === "/ipv6") {
      res.writeHead(200, { "x-real-ip": "2001:db8::1" });
      res.end();
      return;
    }

    if (url.pathname === "/multi-header") {
      res.writeHead(200, {
        "x-request-ip": "10.0.0.2",
        "x-response-cinfo": "10.0.0.3",
      });
      res.end();
      return;
    }

    if (url.pathname === "/no-header") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end();
      return;
    }

    if (url.pathname === "/comma-ip") {
      res.writeHead(200, { "x-real-ip": "1.2.3.4, 5.6.7.8" });
      res.end();
      return;
    }

    if (url.pathname === "/redirect") {
      res.writeHead(302, { location: "/other" });
      res.end();
      return;
    }

    if (url.pathname === "/slow") {
      setTimeout(() => {
        res.writeHead(200, { "x-real-ip": "1.2.3.4" });
        res.end();
      }, 300);
      return;
    }

    res.writeHead(404);
    res.end();
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

describe("probeHttpHeader", () => {
  it("extracts IP from valid header", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/valid-ip`,
      ["cdn-user-ip"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.ip).toBe("10.0.0.1");
      expect(result.location).toBeNull();
      expect(result.colo).toBeNull();
    }
  });

  it("extracts IPv6", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/ipv6`,
      ["x-real-ip"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ip).toBe("2001:db8::1");
  });

  it("checks headers in order", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/multi-header`,
      ["x-request-ip", "x-response-cinfo"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ip).toBe("10.0.0.2");
  });

  it("returns HEADER_MISSING when no matching headers", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/no-header`,
      ["x-real-ip"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("HEADER_MISSING");
  });

  it("returns PARSE_ERROR for comma-separated IPs", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/comma-ip`,
      ["x-real-ip"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("PARSE_ERROR");
  });

  it("returns REDIRECT for 3xx", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/redirect`,
      ["x-real-ip"],
      { timeout: 5000 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("REDIRECT");
  });

  it("returns TIMEOUT for slow response", async () => {
    const result = await probeHttpHeader(
      `http://127.0.0.1:${port}/slow`,
      ["x-real-ip"],
      { timeout: 50 },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("TIMEOUT");
  });
});
