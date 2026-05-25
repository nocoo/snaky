import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSecrets } from "./secrets.js";

describe("loadSecrets", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "snaky-secrets-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty object when file does not exist", () => {
    const result = loadSecrets(join(dir, "nonexistent"));
    expect(result).toEqual({});
  });

  it("returns echoApiKey when file is valid JSON", () => {
    const path = join(dir, ".snaky");
    writeFileSync(path, JSON.stringify({ echoApiKey: "test-key-123" }));
    const result = loadSecrets(path);
    expect(result.echoApiKey).toBe("test-key-123");
  });

  it("returns empty object for malformed JSON", () => {
    const path = join(dir, ".snaky");
    writeFileSync(path, "not json");
    const result = loadSecrets(path);
    expect(result).toEqual({});
  });

  it("returns undefined echoApiKey when field is not a string", () => {
    const path = join(dir, ".snaky");
    writeFileSync(path, JSON.stringify({ echoApiKey: 12345 }));
    const result = loadSecrets(path);
    expect(result.echoApiKey).toBeUndefined();
  });

  it("ignores unknown fields", () => {
    const path = join(dir, ".snaky");
    writeFileSync(path, JSON.stringify({ echoApiKey: "key", other: "val" }));
    const result = loadSecrets(path);
    expect(result).toEqual({ echoApiKey: "key" });
  });
});
