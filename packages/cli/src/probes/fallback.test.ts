import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeWithFallback } from "./fallback.js";

let server: Server;
let port: number;

beforeAll(async () => {
  let _primaryCallCount = 0;

  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost`);

    if (url.pathname === "/primary/cdn-cgi/trace") {
      _primaryCallCount++;
      if (url.searchParams.get("fail") === "true") {
        res.writeHead(500);
        res.end("Error");
        return;
      }
      res.writeHead(200);
      res.end("ip=1.1.1.1\nloc=US\ncolo=LAX\n");
      return;
    }

    if (url.pathname === "/fallback/cdn-cgi/trace") {
      if (url.searchParams.get("fail") === "true") {
        res.writeHead(500);
        res.end("Error");
        return;
      }
      res.writeHead(200);
      res.end("ip=2.2.2.2\nloc=JP\ncolo=NRT\n");
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

describe("probeWithFallback", () => {
  it("returns primary result when primary succeeds", async () => {
    const result = await probeWithFallback(
      `http://127.0.0.1:${port}/primary`,
      `http://127.0.0.1:${port}/fallback`,
      { timeout: 5000, retries: 2 },
    );
    expect(result.result.ok).toBe(true);
    if (result.result.ok) expect(result.result.ip).toBe("1.1.1.1");
    expect(result.usedFallback).toBe(false);
  });

  it("falls back when primary fails", async () => {
    const result = await probeWithFallback(
      `http://127.0.0.1:${port}/primary?fail=true`,
      `http://127.0.0.1:${port}/fallback`,
      { timeout: 5000, retries: 2 },
    );
    expect(result.result.ok).toBe(true);
    if (result.result.ok) expect(result.result.ip).toBe("2.2.2.2");
    expect(result.usedFallback).toBe(true);
  });

  it("reports failure when both fail (fallback retries exhausted)", async () => {
    const result = await probeWithFallback(
      `http://127.0.0.1:${port}/primary?fail=true`,
      `http://127.0.0.1:${port}/fallback?fail=true`,
      { timeout: 5000, retries: 1 },
    );
    expect(result.result.ok).toBe(false);
    expect(result.usedFallback).toBe(false);
  });

  it("works without fallback (retries primary)", async () => {
    const result = await probeWithFallback(
      `http://127.0.0.1:${port}/primary`,
      undefined,
      { timeout: 5000, retries: 2 },
    );
    expect(result.result.ok).toBe(true);
    if (result.result.ok) expect(result.result.ip).toBe("1.1.1.1");
    expect(result.usedFallback).toBe(false);
  });
});
