import { execFileSync } from "node:child_process";
import { platform } from "node:os";
import { ProxyAgent, setGlobalDispatcher } from "undici";

export type ProxySource = "flag" | "env" | "system";

export type DetectedProxy = {
  url: string;
  source: ProxySource;
};

export function detectProxy(opts: { explicit?: string; disabled?: boolean }): DetectedProxy | null {
  if (opts.disabled) return null;
  if (opts.explicit) return { url: normalizeProxyUrl(opts.explicit), source: "flag" };

  const envUrl =
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.ALL_PROXY ||
    process.env.all_proxy;
  if (envUrl) return { url: normalizeProxyUrl(envUrl), source: "env" };

  if (platform() === "darwin") {
    const sysUrl = detectMacOSProxy();
    if (sysUrl) return { url: sysUrl, source: "system" };
  }

  return null;
}

export function installProxyAgent(url: string): void {
  setGlobalDispatcher(new ProxyAgent(url));
}

function normalizeProxyUrl(raw: string): string {
  const trimmed = raw.trim();
  if (/^[a-z]+:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function detectMacOSProxy(): string | null {
  try {
    const out = execFileSync("/usr/sbin/scutil", ["--proxy"], { encoding: "utf8", timeout: 1000 });
    const httpsEnabled = /HTTPSEnable\s*:\s*1/.test(out);
    const httpEnabled = /HTTPEnable\s*:\s*1/.test(out);
    if (!httpsEnabled && !httpEnabled) return null;

    const prefix = httpsEnabled ? "HTTPS" : "HTTP";
    const host = matchField(out, `${prefix}Proxy`);
    const port = matchField(out, `${prefix}Port`);
    if (!host || !port) return null;
    return `http://${host}:${port}`;
  } catch {
    return null;
  }
}

function matchField(text: string, key: string): string | null {
  const re = new RegExp(`${key}\\s*:\\s*([^\\s]+)`);
  const m = text.match(re);
  return m?.[1] ?? null;
}
