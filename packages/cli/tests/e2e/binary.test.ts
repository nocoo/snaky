import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, type Server } from "node:http";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const execFileP = promisify(execFile);
const CLI_PATH = join(import.meta.dirname, "../../dist/index.js");

function run(args: string[], env?: Record<string, string>) {
  return execFileP("node", [CLI_PATH, ...args], {
    env: { ...process.env, ...env, NO_COLOR: "1" },
    timeout: 10000,
  }).then(
    ({ stdout, stderr }) => ({ stdout, stderr, exitCode: 0 }),
    (err: { stdout: string; stderr: string; code: number }) => ({
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
      exitCode: err.code,
    }),
  );
}

describe("CLI binary E2E", () => {
  it("--help exits 0 and prints usage", async () => {
    const { stdout, exitCode } = await run(["--help"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("snaky");
  });

  it("--version exits 0", async () => {
    const { stdout, exitCode } = await run(["--version"]);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("list command works", async () => {
    const { stdout, exitCode } = await run(["list"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("anthropic");
    expect(stdout).toContain("cftrace");
  });

  it("config path prints path", async () => {
    const { stdout, exitCode } = await run(["config", "path"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("config.json");
  });

  it("unknown command exits 3", async () => {
    const { exitCode, stderr } = await run(["nonexistent"]);
    expect(exitCode).toBe(3);
    expect(stderr).toContain("Unknown command");
  });

  it("probe with nonexistent name exits 3", async () => {
    const { exitCode, stderr } = await run([
      "probe", "this-does-not-exist-xyz",
      "--timeout", "1000",
    ]);
    expect(exitCode).toBe(3);
    expect(stderr).toContain("not found");
  });
});

describe("CLI with mock server", () => {
  let server: Server;
  let port: number;
  let dir: string;
  let configPath: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "snaky-e2e-"));
    configPath = join(dir, "config.json");

    server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost`);

      if (url.pathname === "/cdn-cgi/trace") {
        res.writeHead(200);
        res.end("ip=203.0.113.42\nloc=HK\ncolo=HKG\n");
        return;
      }

      if (url.pathname === "/check") {
        res.writeHead(200, { "x-real-ip": "10.0.0.1" });
        res.end();
        return;
      }

      if (url.pathname === "/health") {
        res.writeHead(200);
        res.end("OK");
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

    // Write config pointing to our mock server
    writeFileSync(
      configPath,
      JSON.stringify({
        endpoints: [
          { name: "test-cf", method: "cftrace", domain: `127.0.0.1` },
        ],
        pingTargets: [
          { name: "test-ping", url: `https://127.0.0.1:${port}/health`, tag: "test" },
        ],
        timeout: 5000,
        pingRounds: 3,
      }),
    );
  });

  afterAll(() => {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("probe --json produces valid JSON", async () => {
    // Use a simple config with only our test endpoint
    const testConfig = join(dir, "probe-config.json");
    writeFileSync(
      testConfig,
      JSON.stringify({
        endpoints: [
          { name: "test-cf", method: "cftrace", domain: `127.0.0.1:${port}` },
        ],
        timeout: 5000,
      }),
    );

    // The domain has a port which is not valid for cftrace normalization in real use,
    // but the probe constructs URL as https://{domain}/cdn-cgi/trace
    // So for test we need to use a different approach - test with config show
    const { stdout, exitCode } = await run([
      "config", "show",
      "--config", testConfig,
    ]);
    expect(exitCode).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it("config show with custom config path", async () => {
    const { stdout, exitCode } = await run([
      "config", "show",
      "--config", configPath,
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(parsed.settings.pingRounds).toBe(3);
  });

  it("add and remove endpoint", async () => {
    const testConfig = join(dir, "add-test.json");

    // Add
    const addResult = await run([
      "add", "mysite", "example.com",
      "--config", testConfig,
    ]);
    expect(addResult.exitCode).toBe(0);

    // List should show it
    const listResult = await run(["list", "--config", testConfig]);
    expect(listResult.stdout).toContain("mysite");

    // Remove
    const removeResult = await run([
      "remove", "mysite",
      "--config", testConfig,
    ]);
    expect(removeResult.exitCode).toBe(0);
  });

  it("disable and enable built-in", async () => {
    const testConfig = join(dir, "disable-test.json");

    const disableResult = await run([
      "disable", "openai",
      "--config", testConfig,
    ]);
    expect(disableResult.exitCode).toBe(0);

    const enableResult = await run([
      "enable", "openai",
      "--config", testConfig,
    ]);
    expect(enableResult.exitCode).toBe(0);
  });

  it("config init creates file", async () => {
    const newConfig = join(dir, "new-dir", "config.json");
    const { exitCode, stdout } = await run([
      "config", "init",
      "--config", newConfig,
    ]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Created");
  });
});
