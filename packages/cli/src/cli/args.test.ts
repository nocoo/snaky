import { describe, it, expect } from "vitest";
import { parseCliArgs } from "./args.js";

describe("parseCliArgs", () => {
  it("no args → all mode", () => {
    const result = parseCliArgs([]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.type).toBe("run");
      if (result.command.type === "run") expect(result.command.mode).toBe("all");
    }
  });

  it("probe with names", () => {
    const result = parseCliArgs(["probe", "openai", "discord"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "run") {
      expect(result.command.mode).toBe("probe");
      expect(result.command.names).toEqual(["openai", "discord"]);
    }
  });

  it("probe without names → all probe endpoints", () => {
    const result = parseCliArgs(["probe"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "run") {
      expect(result.command.mode).toBe("probe");
      expect(result.command.names).toBeUndefined();
    }
  });

  it("ping", () => {
    const result = parseCliArgs(["ping"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "run") {
      expect(result.command.mode).toBe("ping");
    }
  });

  it("list", () => {
    const result = parseCliArgs(["list"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("list");
  });

  it("add cftrace (shorthand)", () => {
    const result = parseCliArgs(["add", "mysite", "mysite.com"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "add") {
      expect(result.command.name).toBe("mysite");
      expect(result.command.method).toBe("cftrace");
      expect(result.command.domain).toBe("mysite.com");
    }
  });

  it("add http-header", () => {
    const result = parseCliArgs([
      "add", "my-check",
      "--method", "http-header",
      "--url", "https://example.com/check",
      "--header", "x-real-ip",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "add") {
      expect(result.command.method).toBe("http-header");
      expect(result.command.url).toBe("https://example.com/check");
      expect(result.command.headers).toEqual(["x-real-ip"]);
    }
  });

  it("add http-ping", () => {
    const result = parseCliArgs([
      "add", "my-ping",
      "--method", "http-ping",
      "--url", "https://example.com/health",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "add") {
      expect(result.command.method).toBe("http-ping");
      expect(result.command.url).toBe("https://example.com/health");
    }
  });

  it("remove", () => {
    const result = parseCliArgs(["remove", "openai"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.command.type).toBe("remove");
      if (result.command.type === "remove") expect(result.command.name).toBe("openai");
    }
  });

  it("disable", () => {
    const result = parseCliArgs(["disable", "openai"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "disable") {
      expect(result.command.name).toBe("openai");
    }
  });

  it("enable", () => {
    const result = parseCliArgs(["enable", "openai"]);
    expect(result.ok).toBe(true);
    if (result.ok && result.command.type === "enable") {
      expect(result.command.name).toBe("openai");
    }
  });

  it("config path", () => {
    const result = parseCliArgs(["config", "path"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("config-path");
  });

  it("config show", () => {
    const result = parseCliArgs(["config", "show"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("config-show");
  });

  it("config init", () => {
    const result = parseCliArgs(["config", "init"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("config-init");
  });

  it("--json flag", () => {
    const result = parseCliArgs(["--json"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.json).toBe(true);
  });

  it("--timeout flag", () => {
    const result = parseCliArgs(["--timeout", "3000"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.timeout).toBe(3000);
  });

  it("--concurrency flag", () => {
    const result = parseCliArgs(["--concurrency", "5"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.concurrency).toBe(5);
  });

  it("--no-color flag", () => {
    const result = parseCliArgs(["--no-color"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.noColor).toBe(true);
  });

  it("--category flag", () => {
    const result = parseCliArgs(["--category", "ai"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.category).toBe("ai");
  });

  it("--config flag", () => {
    const result = parseCliArgs(["--config", "/tmp/config.json"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.config).toBe("/tmp/config.json");
  });

  it("--version flag", () => {
    const result = parseCliArgs(["--version"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("version");
  });

  it("--help flag", () => {
    const result = parseCliArgs(["--help"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.command.type).toBe("help");
  });

  it("rejects add with domain + --method http-header", () => {
    const result = parseCliArgs([
      "add", "bad", "domain.com",
      "--method", "http-header",
      "--url", "https://x.com",
      "--header", "x-ip",
    ]);
    expect(result.ok).toBe(false);
  });
});
