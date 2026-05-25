import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BUILTIN_ENDPOINTS, BUILTIN_PING_TARGETS } from "./builtins.js";

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

type MutateSuccess = { ok: true; message?: string };
type MutateError = { ok: false; error: string };
type MutateResult = MutateSuccess | MutateError;

type ConfigFile = {
  endpoints?: Record<string, unknown>[];
  pingTargets?: Record<string, unknown>[];
  [key: string]: unknown;
};

type ReadResult = { ok: true; config: ConfigFile } | { ok: false; error: string };

function readConfigFile(path: string): ReadResult {
  if (!existsSync(path)) return { ok: true, config: {} };
  const content = readFileSync(path, "utf-8");
  try {
    return { ok: true, config: JSON.parse(content) as ConfigFile };
  } catch {
    return { ok: false, error: `Config file is not valid JSON: ${path}` };
  }
}

function writeConfigFile(path: string, config: ConfigFile): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

export type AddInput =
  | { name: string; method: "cftrace"; domain: string }
  | { name: string; method: "http-header"; url: string; headers: string[] }
  | { name: string; method: "http-ping"; url: string };

export function addEndpoint(configPath: string, input: AddInput): MutateResult {
  if (!NAME_RE.test(input.name)) {
    return { ok: false, error: `Invalid name "${input.name}": must match /^[a-z0-9][a-z0-9._-]{0,62}$/` };
  }

  if (input.method === "cftrace") {
    const d = input.domain;
    if (d.includes("://")) return { ok: false, error: "Domain must not include scheme" };
    if (d.includes(":")) return { ok: false, error: "Domain must not include port" };
    if (d.includes("/")) return { ok: false, error: "Domain must not include path" };
    if (!DOMAIN_RE.test(d)) return { ok: false, error: `Invalid domain "${d}"` };
  }

  if (input.method === "http-header" || input.method === "http-ping") {
    let valid = false;
    try {
      const u = new URL(input.url);
      valid = u.protocol === "https:" && u.hostname.length > 0;
    } catch { /* invalid URL */ }
    if (!valid) {
      return { ok: false, error: "URL must be a valid HTTPS URL" };
    }
  }

  if (input.method === "http-header") {
    for (const h of input.headers) {
      if (!HEADER_NAME_RE.test(h)) {
        return { ok: false, error: `Invalid header name "${h}"` };
      }
    }
  }

  const read = readConfigFile(configPath);
  if (!read.ok) return { ok: false, error: read.error };
  const config = read.config;

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
  const read = readConfigFile(configPath);
  if (!read.ok) return { ok: false, error: read.error };
  const config = read.config;
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
  const read = readConfigFile(configPath);
  if (!read.ok) return { ok: false, error: read.error };
  const config = read.config;
  const endpoints = config.endpoints ?? [];
  const pingTargets = config.pingTargets ?? [];

  const existingEp = endpoints.find((e) => e.name === name);
  if (existingEp) {
    existingEp.disabled = true;
    config.endpoints = endpoints;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const existingPt = pingTargets.find((p) => p.name === name);
  if (existingPt) {
    existingPt.disabled = true;
    config.pingTargets = pingTargets;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const isBuiltinEp = BUILTIN_ENDPOINTS.some((b) => b.name === name);
  if (isBuiltinEp) {
    config.endpoints = [...endpoints, { name, disabled: true }];
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const isBuiltinPt = BUILTIN_PING_TARGETS.some((b) => b.name === name);
  if (isBuiltinPt) {
    config.pingTargets = [...pingTargets, { name, disabled: true }];
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  return { ok: false, error: `Endpoint '${name}' not found` };
}

export function enableEndpoint(
  configPath: string,
  name: string,
): MutateResult {
  const read = readConfigFile(configPath);
  if (!read.ok) return { ok: false, error: read.error };
  const config = read.config;
  const endpoints = config.endpoints ?? [];
  const pingTargets = config.pingTargets ?? [];

  const epIdx = endpoints.findIndex((e) => e.name === name);
  if (epIdx >= 0) {
    const entry = endpoints[epIdx];
    if (!entry) return { ok: false, error: `Endpoint '${name}' not found` };
    const isTombstone =
      entry.disabled === true && !entry.method && !entry.domain && !entry.url;
    if (isTombstone) {
      endpoints.splice(epIdx, 1);
    } else {
      delete entry.disabled;
    }
    config.endpoints = endpoints;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const ptIdx = pingTargets.findIndex((p) => p.name === name);
  if (ptIdx >= 0) {
    const entry = pingTargets[ptIdx];
    if (!entry) return { ok: false, error: `Endpoint '${name}' not found` };
    const isTombstone =
      entry.disabled === true && !entry.url;
    if (isTombstone) {
      pingTargets.splice(ptIdx, 1);
    } else {
      delete entry.disabled;
    }
    config.pingTargets = pingTargets;
    writeConfigFile(configPath, config);
    return { ok: true };
  }

  const isBuiltin =
    BUILTIN_ENDPOINTS.some((b) => b.name === name) ||
    BUILTIN_PING_TARGETS.some((b) => b.name === name);

  if (isBuiltin) {
    return { ok: true };
  }

  return { ok: false, error: `Endpoint '${name}' not found` };
}
