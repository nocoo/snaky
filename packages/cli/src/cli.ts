import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AddCommand, NameCommand, RunCommand } from "./cli/args.js";
import { parseCliArgs } from "./cli/args.js";
import { computeExitCode } from "./cli/exit-code.js";
import { BUILTIN_ENDPOINTS, BUILTIN_PING_TARGETS } from "./config/builtins.js";
import { loadConfig } from "./config/loader.js";
import { addEndpoint, disableEndpoint, enableEndpoint, removeEndpoint } from "./config/mutate.js";
import type { Endpoint } from "./config/types.js";
import { normalizeDomain } from "./normalize.js";
import { formatJson } from "./output/json.js";
import { formatPingTable, formatProbeTable } from "./output/table.js";
import type { FullOutput, ProbeEntry } from "./output/types.js";
import { probeWithFallback } from "./probes/fallback.js";
import { probeHttpHeader } from "./probes/http-header.js";
import { probeHttpPing } from "./probes/http-ping.js";
import type { ProbeResult } from "./probes/types.js";
import { runPing } from "./runner/ping-runner.js";
import { runProbes } from "./runner/probe-runner.js";
import { buildUniqueSummary } from "./runner/summary.js";

declare const __VERSION__: string;

const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "snaky", "config.json");

export async function main(argv: string[]): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (!parsed.ok) {
    process.stderr.write(`Error: ${parsed.error}\n`);
    return 3;
  }

  const { command, flags } = parsed;
  const configPath = flags.config ?? DEFAULT_CONFIG_PATH;

  if (command.type === "version") {
    process.stdout.write(`${__VERSION__}\n`);
    return 0;
  }

  if (command.type === "help") {
    printHelp();
    return 0;
  }

  if (command.type === "config-path") {
    process.stdout.write(`${DEFAULT_CONFIG_PATH}\n`);
    return 0;
  }

  if (command.type === "config-init") {
    if (existsSync(configPath)) {
      process.stderr.write(`Config file already exists: ${configPath}\n`);
      return 0;
    }
    const dir = dirname(configPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(configPath, `${JSON.stringify({}, null, 2)}\n`);
    process.stdout.write(`Created config file: ${configPath}\n`);
    return 0;
  }

  if (command.type === "config-show") {
    const loaded = loadConfig(existsSync(configPath) ? configPath : undefined);
    if (!loaded.ok) {
      process.stderr.write(`Error: ${loaded.error}\n`);
      return 3;
    }
    process.stdout.write(`${JSON.stringify(loaded.config, null, 2)}\n`);
    return 0;
  }

  if (command.type === "list") {
    return handleList(configPath, flags);
  }

  if (command.type === "add") {
    return handleAdd(command, configPath);
  }

  if (command.type === "remove" || command.type === "disable" || command.type === "enable") {
    return handleMutate(command, configPath);
  }

  if (command.type === "run") {
    return handleRun(command, flags, configPath);
  }

  return 0;
}

function handleList(configPath: string, _flags: { noColor?: boolean }): number {
  const loaded = loadConfig(existsSync(configPath) ? configPath : undefined);
  if (!loaded.ok) {
    process.stderr.write(`Error: ${loaded.error}\n`);
    return 3;
  }

  const { endpoints, pingTargets } = loaded.config;
  const lines: string[] = [];
  lines.push("Name                Method        Category    Source");
  lines.push("─".repeat(60));

  for (const ep of endpoints) {
    const source = BUILTIN_ENDPOINTS.some((b) => b.name === ep.name) ? "built-in" : "user";
    lines.push(
      `${ep.name.padEnd(20)}${ep.method.padEnd(14)}${ep.category.padEnd(12)}${source}`,
    );
  }

  for (const pt of pingTargets) {
    const source = BUILTIN_PING_TARGETS.some((b) => b.name === pt.name) ? "built-in" : "user";
    lines.push(
      `${pt.name.padEnd(20)}${"http-ping".padEnd(14)}${pt.tag.padEnd(12)}${source}`,
    );
  }

  process.stdout.write(`${lines.join("\n")}\n`);
  return 0;
}

function handleAdd(command: AddCommand, configPath: string): number {
  if (command.method === "cftrace" && command.domain) {
    const normalized = normalizeDomain(command.domain);
    if (!normalized.ok) {
      process.stderr.write(`Error: ${normalized.message}\n`);
      return 3;
    }
    const result = addEndpoint(configPath, {
      name: command.name,
      method: "cftrace",
      domain: normalized.domain,
    });
    if (!result.ok) {
      process.stderr.write(`Error: ${result.error}\n`);
      return 3;
    }
  } else if (command.method === "http-header") {
    const result = addEndpoint(configPath, {
      name: command.name,
      method: "http-header",
      url: command.url!,
      headers: command.headers!,
    });
    if (!result.ok) {
      process.stderr.write(`Error: ${result.error}\n`);
      return 3;
    }
  } else if (command.method === "http-ping") {
    const result = addEndpoint(configPath, {
      name: command.name,
      method: "http-ping",
      url: command.url!,
    });
    if (!result.ok) {
      process.stderr.write(`Error: ${result.error}\n`);
      return 3;
    }
  }
  process.stderr.write(`Added endpoint: ${command.name}\n`);
  return 0;
}

function handleMutate(command: NameCommand, configPath: string): number {
  let result: { ok: boolean; error?: string; message?: string };
  if (command.type === "remove") {
    result = removeEndpoint(configPath, command.name);
  } else if (command.type === "disable") {
    result = disableEndpoint(configPath, command.name);
  } else {
    result = enableEndpoint(configPath, command.name);
  }

  if (!result.ok) {
    process.stderr.write(`Error: ${result.error}\n`);
    return 3;
  }
  if (result.message) {
    process.stderr.write(`${result.message}\n`);
  }
  return 0;
}

async function handleRun(
  command: RunCommand,
  flags: {
    json?: boolean;
    noColor?: boolean;
    timeout?: number;
    concurrency?: number;
    category?: string;
    tier?: number;
    config?: string;
  },
  configPath: string,
): Promise<number> {
  const loaded = loadConfig(existsSync(configPath) ? configPath : undefined);
  if (!loaded.ok) {
    process.stderr.write(`Error: ${loaded.error}\n`);
    return 3;
  }

  for (const w of loaded.warnings) {
    process.stderr.write(`Warning: ${w}\n`);
  }

  const config = loaded.config;
  const timeout = flags.timeout ?? config.settings.timeout;
  const concurrency = flags.concurrency ?? config.settings.concurrency;
  const tier = flags.tier ?? config.settings.tier;

  let probeResults: ProbeResult[] | null = null;
  let probeEntries: ProbeEntry[] | null = null;
  let pingResults: import("./runner/ping-runner.js").PingResult[] | null = null;

  const shouldProbe = command.mode === "all" || command.mode === "probe";
  const shouldPing = command.mode === "all" || command.mode === "ping";

  // Resolve endpoints (synchronous validation — may exit 3)
  let endpoints: Endpoint[] = [];
  type FallbackMeta = { usedFallback: boolean; resolvedTarget?: string };
  const fallbackMeta = new Map<string, FallbackMeta>();

  if (shouldProbe) {
    endpoints = config.endpoints.filter((e) => e.tier <= tier);

    if (flags.category) {
      endpoints = endpoints.filter((e) => e.category === flags.category);
    }

    if (command.names) {
      const selected: Endpoint[] = [];
      for (const name of command.names) {
        const ep = endpoints.find((e) => e.name === name);
        if (!ep) {
          process.stderr.write(`Endpoint '${name}' not found\n`);
          return 3;
        }
        selected.push(ep);
      }
      endpoints = selected;
    }
  }

  // Build async tasks
  const probeTask = shouldProbe
    ? (async () => {
        const probeFn = async (ep: Endpoint): Promise<ProbeResult> => {
          if (ep.method === "cftrace") {
            const fb = await probeWithFallback(
              `https://${ep.domain}`,
              ep.fallbackDomain ? `https://${ep.fallbackDomain}` : undefined,
              { timeout, retries: config.settings.retries },
            );
            fallbackMeta.set(ep.name, {
              usedFallback: fb.usedFallback,
              resolvedTarget: fb.usedFallback ? ep.fallbackDomain : undefined,
            });
            return fb.result;
          }
          const { withRetry } = await import("./probes/retry.js");
          const result = await withRetry(
            () => probeHttpHeader(ep.url, ep.headers, { timeout }),
            { retries: config.settings.retries },
          );
          fallbackMeta.set(ep.name, { usedFallback: false });
          return result;
        };
        return runProbes(endpoints, { concurrency, probeFn });
      })()
    : null;

  const pingTask = shouldPing
    ? runPing(config.pingTargets.filter((t) => t.tier <= tier), {
        rounds: config.settings.pingRounds,
        pingTimeout: config.settings.pingTimeout,
        concurrency,
        pingFn: (url, opts) => probeHttpPing(url, opts),
      })
    : null;

  // Execute concurrently
  [probeResults, pingResults] = await Promise.all([probeTask, pingTask]);

  if (probeResults) {
    probeEntries = endpoints.map((ep, i) => {
      const r = probeResults![i]!;
      const meta = fallbackMeta.get(ep.name)!;
      const base = {
        name: ep.name,
        category: ep.category,
        method: ep.method as "cftrace" | "http-header",
        target: ep.method === "cftrace" ? ep.domain : ep.url,
        usedFallback: meta.usedFallback,
        ...(meta.resolvedTarget ? { resolvedTarget: meta.resolvedTarget } : {}),
      };
      if (r.ok) {
        return {
          ...base,
          ok: true as const,
          ip: r.ip,
          location: r.location,
          colo: r.colo,
          responseTimeMs: r.responseTimeMs,
        };
      }
      return {
        ...base,
        ok: false as const,
        responseTimeMs: r.responseTimeMs,
        error: { code: r.code, message: r.message },
      };
    });
  }

  // Output
  const mode = command.mode;
  if (flags.json) {
    const output: FullOutput = {
      mode,
      probe: probeEntries
        ? {
            results: probeEntries,
            summary: {
              total: probeEntries.length,
              succeeded: probeEntries.filter((e) => e.ok).length,
              failed: probeEntries.filter((e) => !e.ok).length,
            },
            uniqueIps: buildUniqueSummary(probeResults ?? []),
          }
        : null,
      ping: pingResults ? { results: pingResults } : null,
    };
    process.stdout.write(`${formatJson(output)}\n`);
  } else {
    if (probeEntries) {
      const uniqueIps = buildUniqueSummary(probeResults ?? []);
      process.stdout.write(
        formatProbeTable(probeEntries, uniqueIps, { noColor: flags.noColor }),
      );
    }
    if (pingResults) {
      if (probeEntries) process.stdout.write("\n");
      process.stdout.write(formatPingTable(pingResults, { noColor: flags.noColor }));
    }
  }

  return computeExitCode(mode, probeResults, pingResults);
}

function printHelp(): void {
  process.stdout.write(`Usage: snaky [command] [options]

Commands:
  (none)              Run all: probe + ping
  probe [name...]     Probe specific endpoints (IP detection)
  ping                Connectivity test only (latency)
  list                List all endpoints
  add <name> <domain> Add cftrace endpoint
  remove <name>       Remove an endpoint
  disable <name>      Suppress an endpoint
  enable <name>       Re-enable an endpoint
  config path         Print config file path
  config show         Print effective config
  config init         Create config file

Options:
  --json              Output JSON to stdout
  --timeout <ms>      Per-endpoint timeout (default: 5000)
  --concurrency <n>   Max parallel requests (default: 10)
  --tier <n>          Max endpoint tier to include (default: 1)
  --config <path>     Custom config file path
  --category <cat>    Filter by category
  --no-color          Disable colored output
  --version           Print version
  --help              Print this help
`);
}
