import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BUILTIN_ENDPOINTS, BUILTIN_PING_TARGETS } from "./builtins.js";

type MutateSuccess = { ok: true; message?: string };
type MutateError = { ok: false; error: string };
type MutateResult = MutateSuccess | MutateError;

type ConfigFile = {
  endpoints?: Record<string, unknown>[];
  pingTargets?: Record<string, unknown>[];
  [key: string]: unknown;
};

function readConfigFile(path: string): ConfigFile {
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as ConfigFile;
}

function writeConfigFile(path: string, config: ConfigFile): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n");
}

export type AddInput =
  | { name: string; method: "cftrace"; domain: string }
  | { name: string; method: "http-header"; url: string; headers: string[] }
  | { name: string; method: "http-ping"; url: string };

export function addEndpoint(configPath: string, input: AddInput): MutateResult {
  const config = readConfigFile(configPath);

  const allEndpoints = config.endpoints ?? [];
  const allPingTargets = config.pingTargets ?? [];
  const allNames = [
    ...allEndpoints.map((e) => e.name as string),
    ...allPingTargets.map((p) => p.name as string),
  ];

  if (allNames.includes(input.name)) {
    return { ok: false, error: `Endpoint "${input.name}" already exists in config` };
  }

  if (input.method === "http-ping") {
    config.pingTargets = [
      ...allPingTargets,
      { name: input.name, url: input.url, tag: "user" },
    ];
  } else if (input.method === "http-header") {
    config.endpoints = [
      ...allEndpoints,
      {
        name: input.name,
        method: "http-header",
        url: input.url,
        headers: input.headers,
      },
    ];
  } else {
    config.endpoints = [
      ...allEndpoints,
      { name: input.name, method: "cftrace", domain: input.domain },
    ];
  }

  writeConfigFile(configPath, config);
  return { ok: true };
}

export function removeEndpoint(
  configPath: string,
  name: string,
): MutateResult {
  const config = readConfigFile(configPath);
  const endpoints = config.endpoints ?? [];
  const pingTargets = config.pingTargets ?? [];

  const epIdx = endpoints.findIndex((e) => e.name === name);
  const ptIdx = pingTargets.findIndex((p) => p.name === name);

  if (epIdx >= 0) {
    endpoints.splice(epIdx, 1);
    config.endpoints = endpoints;
    writeConfigFile(configPath, config);
    const isBuiltin = BUILTIN_ENDPOINTS.some((b) => b.name === name);
    return {
      ok: true,
      message: isBuiltin
        ? `Removed override for "${name}" — built-in resurfaces`
        : `Removed endpoint "${name}"`,
    };
  }

  if (ptIdx >= 0) {
    pingTargets.splice(ptIdx, 1);
    config.pingTargets = pingTargets;
    writeConfigFile(configPath, config);
    return { ok: true, message: `Removed ping target "${name}"` };
  }

  const isBuiltin =
    BUILTIN_ENDPOINTS.some((b) => b.name === name) ||
    BUILTIN_PING_TARGETS.some((b) => b.name === name);

  if (isBuiltin) {
    return {
      ok: false,
      error: `Cannot remove built-in endpoint. Use \`snaky disable ${name}\` to suppress it.`,
    };
  }

  return { ok: false, error: `Endpoint '${name}' not found` };
}

export function disableEndpoint(
  configPath: string,
  name: string,
): MutateResult {
  const config = readConfigFile(configPath);
  const endpoints = config.endpoints ?? [];

  const existing = endpoints.find((e) => e.name === name);
  if (existing) {
    existing.disabled = true;
    config.endpoints = endpoints;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const isBuiltin =
    BUILTIN_ENDPOINTS.some((b) => b.name === name) ||
    BUILTIN_PING_TARGETS.some((b) => b.name === name);

  if (isBuiltin) {
    config.endpoints = [...endpoints, { name, disabled: true }];
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  return { ok: false, error: `Endpoint '${name}' not found` };
}

export function enableEndpoint(
  configPath: string,
  name: string,
): MutateResult {
  const config = readConfigFile(configPath);
  const endpoints = config.endpoints ?? [];

  const idx = endpoints.findIndex((e) => e.name === name);
  if (idx >= 0) {
    const entry = endpoints[idx]!;
    const isTombstone =
      entry.disabled === true && !entry.method && !entry.domain && !entry.url;
    if (isTombstone) {
      endpoints.splice(idx, 1);
    } else {
      delete entry.disabled;
    }
    config.endpoints = endpoints;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const isBuiltin =
    BUILTIN_ENDPOINTS.some((b) => b.name === name) ||
    BUILTIN_PING_TARGETS.some((b) => b.name === name);

  if (isBuiltin) {
    return { ok: true }; // already enabled (no tombstone in config)
  }

  return { ok: false, error: `Endpoint '${name}' not found` };
}
