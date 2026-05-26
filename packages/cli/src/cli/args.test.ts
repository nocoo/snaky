import { describe, expect, it } from "vitest";
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

  it("--timeout rejects non-numeric value", () => {
    const result = parseCliArgs(["--timeout", "abc"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--timeout/);
  });

  it("--timeout rejects out-of-range value", () => {
    const result = parseCliArgs(["--timeout", "50"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/100.*60000/);
  });

  it("--concurrency rejects 0", () => {
    const result = parseCliArgs(["--concurrency", "0"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--concurrency/);
  });

  it("--concurrency rejects value above 20", () => {
    const result = parseCliArgs(["--concurrency", "100"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/1.*20/);
  });

  it("--timeout rejects trailing non-numeric chars", () => {
    const result = parseCliArgs(["--timeout", "100abc"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--timeout/);
  });

  it("--concurrency rejects trailing non-numeric chars", () => {
    const result = parseCliArgs(["--concurrency", "1abc"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--concurrency/);
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

  it("--tier flag", () => {
    const result = parseCliArgs(["--tier", "2"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flags.tier).toBe(2);
  });

  it("--tier rejects 0", () => {
    const result = parseCliArgs(["--tier", "0"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--tier/);
  });

  it("--tier rejects value above 9", () => {
    const result = parseCliArgs(["--tier", "10"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--tier/);
  });

  it("--tier rejects non-integer", () => {
    const result = parseCliArgs(["--tier", "1.5"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/--tier/);
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

  it("rejects remove without name", () => {
    const result = parseCliArgs(["remove"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("requires a name");
  });

  it("rejects disable without name", () => {
    const result = parseCliArgs(["disable"]);
    expect(result.ok).toBe(false);
  });

  it("rejects enable without name", () => {
    const result = parseCliArgs(["enable"]);
    expect(result.ok).toBe(false);
  });

  it("rejects add without name", () => {
    const result = parseCliArgs(["add"]);
    expect(result.ok).toBe(false);
  });

  it("rejects config without subcommand", () => {
    const result = parseCliArgs(["config"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unknown config subcommand");
  });

  it("rejects add --method cftrace without domain", () => {
    const result = parseCliArgs(["add", "test", "--method", "cftrace"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("domain");
  });

  it("rejects add without method or domain", () => {
    const result = parseCliArgs(["add", "test"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("requires a domain or --method");
  });

  it("rejects add http-header without --url", () => {
    const result = parseCliArgs(["add", "test", "--method", "http-header", "--header", "x-ip"]);
    expect(result.ok).toBe(false);
  });

  it("rejects add http-header without --header", () => {
    const result = parseCliArgs(["add", "test", "--method", "http-header", "--url", "https://x.com"]);
    expect(result.ok).toBe(false);
  });

  it("rejects add http-ping without --url", () => {
    const result = parseCliArgs(["add", "test", "--method", "http-ping"]);
    expect(result.ok).toBe(false);
  });

  describe("dns-leak", () => {
    it("basic dns-leak command", () => {
      const result = parseCliArgs(["dns-leak"]);
      expect(result.ok).toBe(true);
      if (result.ok && result.command.type === "dns-leak") {
        expect(result.command.rounds).toBeUndefined();
        expect(result.command.extended).toBe(false);
      }
    });

    it("--rounds parses valid value", () => {
      const result = parseCliArgs(["dns-leak", "--rounds", "8"]);
      expect(result.ok).toBe(true);
      if (result.ok && result.command.type === "dns-leak") {
        expect(result.command.rounds).toBe(8);
      }
    });

    it("--rounds rejects 0", () => {
      const result = parseCliArgs(["dns-leak", "--rounds", "0"]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/--rounds/);
    });

    it("--rounds rejects value above 20", () => {
      const result = parseCliArgs(["dns-leak", "--rounds", "21"]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/1.*20/);
    });

    it("--rounds rejects non-integer", () => {
      const result = parseCliArgs(["dns-leak", "--rounds", "2.5"]);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/--rounds/);
    });

    it("--extended flag", () => {
      const result = parseCliArgs(["dns-leak", "--extended"]);
      expect(result.ok).toBe(true);
      if (result.ok && result.command.type === "dns-leak") {
        expect(result.command.extended).toBe(true);
      }
    });

    it("--rounds takes precedence with --extended", () => {
      const result = parseCliArgs(["dns-leak", "--rounds", "3", "--extended"]);
      expect(result.ok).toBe(true);
      if (result.ok && result.command.type === "dns-leak") {
        expect(result.command.rounds).toBe(3);
        expect(result.command.extended).toBe(true);
      }
    });

    it("works with global --json flag", () => {
      const result = parseCliArgs(["dns-leak", "--json"]);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.command.type).toBe("dns-leak");
        expect(result.flags.json).toBe(true);
      }
    });
  });
});
