import { existsSync, readFileSync } from "node:fs";
import { BUILTIN_ENDPOINTS, BUILTIN_PING_TARGETS } from "./builtins.js";
import { validateConfig } from "./schema.js";
import type {
  EffectiveConfig,
  Endpoint,
  PingTarget,
  RawConfig,
  Settings,
} from "./types.js";
import { DEFAULT_SETTINGS as DEFAULTS } from "./types.js";

export type LoadSuccess = {
  ok: true;
  config: EffectiveConfig;
  warnings: string[];
};

export type LoadError = {
  ok: false;
  error: string;
};

export type LoadResult = LoadSuccess | LoadError;

export function loadConfig(path?: string): LoadResult {
  let raw: RawConfig = {};
  const warnings: string[] = [];

  if (path && existsSync(path)) {
    let content: string;
    try {
      content = readFileSync(path, "utf-8");
    } catch (e) {
      return { ok: false, error: `Cannot read config file: ${(e as Error).message}` };
    }

    try {
      raw = JSON.parse(content) as RawConfig;
    } catch {
      return { ok: false, error: `Cannot parse config file: invalid JSON` };
    }

    const validation = validateConfig(raw as Record<string, unknown>);
    if (!validation.ok) {
      return { ok: false, error: validation.errors.join("; ") };
    }
    warnings.push(...validation.warnings);
  }

  const settings: Settings = {
    timeout: (raw.timeout as number) ?? DEFAULTS.timeout,
    pingTimeout: (raw.pingTimeout as number) ?? DEFAULTS.pingTimeout,
    concurrency: (raw.concurrency as number) ?? DEFAULTS.concurrency,
    retries: (raw.retries as number) ?? DEFAULTS.retries,
    pingRounds: (raw.pingRounds as number) ?? DEFAULTS.pingRounds,
    tier: (raw.tier as number) ?? DEFAULTS.tier,
  };

  const userEndpoints = raw.endpoints ?? [];
  const userPingTargets = raw.pingTargets ?? [];

  const disabledNames = new Set<string>();
  const userEndpointMap = new Map<string, Endpoint>();

  for (const ue of userEndpoints) {
    if (ue.disabled) {
      disabledNames.add(ue.name);
      continue;
    }
    if (!ue.method || ue.method === "cftrace") {
      userEndpointMap.set(ue.name, {
        name: ue.name,
        method: "cftrace",
        domain: (ue as { domain?: string }).domain!,
        category: "user",
        tier: ue.tier ?? 1,
      });
    } else if (ue.method === "http-header") {
      const hep = ue as { url?: string; headers?: string[] };
      userEndpointMap.set(ue.name, {
        name: ue.name,
        method: "http-header",
        url: hep.url!,
        headers: hep.headers!,
        category: "user",
        tier: ue.tier ?? 1,
      });
    }
  }

  const endpoints: Endpoint[] = [];
  for (const builtin of BUILTIN_ENDPOINTS) {
    if (disabledNames.has(builtin.name)) continue;
    if (userEndpointMap.has(builtin.name)) continue;
    endpoints.push(builtin);
  }
  for (const [, ep] of userEndpointMap) {
    endpoints.push(ep);
  }

  const disabledPingNames = new Set<string>();
  const userPingMap = new Map<string, PingTarget>();

  for (const upt of userPingTargets) {
    if (upt.disabled) {
      disabledPingNames.add(upt.name);
      continue;
    }
    userPingMap.set(upt.name, {
      name: upt.name,
      url: upt.url!,
      tag: upt.tag ?? "user",
      tier: upt.tier ?? 1,
    });
  }

  const pingTargets: PingTarget[] = [];
  for (const builtin of BUILTIN_PING_TARGETS) {
    if (disabledPingNames.has(builtin.name)) continue;
    if (userPingMap.has(builtin.name)) continue;
    pingTargets.push(builtin);
  }
  for (const [, pt] of userPingMap) {
    pingTargets.push(pt);
  }

  return { ok: true, config: { endpoints, pingTargets, settings }, warnings };
}
