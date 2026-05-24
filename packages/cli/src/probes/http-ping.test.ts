import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { probeHttpPing } from "./http-ping.js";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url!, `http://localhost`);

    if (url.pathname === "/200") {
      res.writeHead(200);
      res.end("OK");
      return;
    }

    if (url.pathname === "/204") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (url.pathname === "/403") {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (url.pathname === "/redirect") {
      res.writeHead(302, { location: `/200` });
      res.end();
      return;
    }

    if (url.pathname === "/slow") {
      setTimeout(() => {
        res.writeHead(200);
        res.end("OK");
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

describe("probeHttpPing", () => {
  it("returns responseTimeMs for 200", async () => {
    const result = await probeHttpPing(`http://127.0.0.1:${port}/200`, {
      timeout: 5000,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("returns responseTimeMs for 204", async () => {
    const result = await probeHttpPing(`http://127.0.0.1:${port}/204`, {
      timeout: 5000,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("returns responseTimeMs for 403 (connectivity confirmed)", async () => {
    const result = await probeHttpPing(`http://127.0.0.1:${port}/403`, {
      timeout: 5000,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("follows redirects and returns success", async () => {
    const result = await probeHttpPing(`http://127.0.0.1:${port}/redirect`, {
      timeout: 5000,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it("returns -1 for timeout", async () => {
    const result = await probeHttpPing(`http://127.0.0.1:${port}/slow`, {
      timeout: 50,
    });
    expect(result).toBe(-1);
  });

  it("returns -1 for connection refused", async () => {
    const result = await probeHttpPing("http://127.0.0.1:19999/test", {
      timeout: 5000,
    });
    expect(result).toBe(-1);
  });

  it("returns -1 for DNS failure", async () => {
    const result = await probeHttpPing(
      "http://this-does-not-exist-12345.invalid/test",
      { timeout: 5000 },
    );
    expect(result).toBe(-1);
  });
});
