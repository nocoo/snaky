import { randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { matchesAnyCidr } from "./cidr.js";
import type { DnsLeakOutput, DnsLeakVerdict, DnsServer } from "./types.js";

export type DetectOptions = {
  rounds: number;
  expectedResolvers?: string[];
  echoApiKey?: string;
  fetchFn?: typeof fetch;
  onProgress?: (message: string) => void;
};

type CollectorResult = {
  dns_servers: string[];
};

const COLLECTOR_BASE = "https://echo-collector.worker.hexly.ai";
const CFTRACE_URL = "https://1.1.1.1/cdn-cgi/trace";
const DNS_SUFFIX = "d.echo.nocoo.cloud";
const LOOKUP_TIMEOUT_MS = 5000;
const ROUND_DELAY_MS = 600;
const POLL_INTERVAL_MS = 2000;
const POLL_ATTEMPTS = 3;

export function generateToken(): string {
  return randomBytes(6).toString("hex");
}

async function lookupWithTimeout(hostname: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    dns.lookup(hostname).then(() => {}, () => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserIp(
  fetchFn: typeof fetch,
): Promise<{ ip: string; countryCode: string } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetchFn(CFTRACE_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const body = await res.text();
    let ip: string | null = null;
    let loc: string | null = null;

    for (const line of body.split("\n")) {
      const idx = line.indexOf("=");
      if (idx === -1) continue;
      const key = line.slice(0, idx);
      const value = line.slice(idx + 1).trim();
      if (key === "ip") ip = value;
      if (key === "loc") loc = value;
    }

    if (!ip || !loc) return null;
    return { ip, countryCode: loc };
  } catch {
    return null;
  }
}

async function pollCollector(
  token: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(POLL_INTERVAL_MS);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetchFn(`${COLLECTOR_BASE}/result/${token}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const data = (await res.json()) as CollectorResult;
      if (data.dns_servers && data.dns_servers.length > 0) {
        return data.dns_servers;
      }
    } catch {
      // poll failed, try next attempt
    }
  }
  return [];
}

async function enrichIps(
  ips: string[],
  apiKey: string,
  fetchFn: typeof fetch,
): Promise<Map<string, { country: string | null; countryCode: string | null; city: string | null; isp: string | null; asn: number | null; asOrg: string | null }>> {
  const result = new Map<string, { country: string | null; countryCode: string | null; city: string | null; isp: string | null; asn: number | null; asOrg: string | null }>();
  const unique = [...new Set(ips)];

  for (const ip of unique) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetchFn(
        `https://echo.nocoo.cloud/api/ip?ip=${encodeURIComponent(ip)}`,
        { headers: { "x-api-key": apiKey }, signal: controller.signal },
      );
      clearTimeout(timer);
      if (!res.ok) continue;

      const data = (await res.json()) as {
        ip: string;
        location?: {
          country?: string;
          countryCode?: string;
          city?: string;
          isp?: string;
          asn?: number;
          asOrg?: string;
        };
      };
      const loc = data.location;
      result.set(ip, {
        country: loc?.country ?? null,
        countryCode: loc?.countryCode ?? null,
        city: loc?.city ?? null,
        isp: loc?.isp ?? null,
        asn: loc?.asn ?? null,
        asOrg: loc?.asOrg ?? null,
      });
    } catch {
      // enrichment failed for this IP, skip
    }
  }
  return result;
}

function determineVerdict(
  dnsServers: DnsServer[],
  userCountryCode: string | null,
  expectedResolvers: string[] | undefined,
  hasApiKey: boolean,
): { verdict: DnsLeakVerdict; servers: DnsServer[] } {
  if (dnsServers.length === 0) {
    return { verdict: "inconclusive", servers: dnsServers };
  }

  if (expectedResolvers && expectedResolvers.length > 0) {
    const servers = dnsServers.map((s) => ({
      ...s,
      leaked: !matchesAnyCidr(s.ip, expectedResolvers),
    }));
    const hasLeak = servers.some((s) => s.leaked);
    return { verdict: hasLeak ? "leak" : "no_leak", servers };
  }

  if (!hasApiKey) {
    return { verdict: "inconclusive", servers: dnsServers };
  }

  if (!userCountryCode) {
    return { verdict: "inconclusive", servers: dnsServers };
  }

  const allEnriched = dnsServers.every((s) => s.countryCode !== null);
  if (!allEnriched) {
    return { verdict: "inconclusive", servers: dnsServers };
  }

  const servers = dnsServers.map((s) => ({
    ...s,
    leaked: s.countryCode !== userCountryCode,
  }));
  const hasLeak = servers.some((s) => s.leaked);
  return { verdict: hasLeak ? "leak" : "no_leak", servers };
}

export async function runDnsLeakDetection(
  opts: DetectOptions,
): Promise<{ output: DnsLeakOutput; exitCode: number }> {
  const fetchFn = opts.fetchFn ?? fetch;
  const token = generateToken();

  opts.onProgress?.("Fetching your IP...");
  const userInfo = await fetchUserIp(fetchFn);
  let userCountry: string | null = null;
  const userIp = userInfo?.ip ?? null;
  const userCountryCode = userInfo?.countryCode ?? null;

  if (userIp && opts.echoApiKey) {
    const enriched = await enrichIps([userIp], opts.echoApiKey, fetchFn);
    const info = enriched.get(userIp);
    if (info) userCountry = info.country;
  }

  opts.onProgress?.("Sending DNS queries...");
  for (let i = 1; i <= opts.rounds; i++) {
    opts.onProgress?.(`Sending DNS queries... (${i}/${opts.rounds})`);
    const hostname = `${token}-${i}.${DNS_SUFFIX}`;
    await lookupWithTimeout(hostname, LOOKUP_TIMEOUT_MS);
    if (i < opts.rounds) await sleep(ROUND_DELAY_MS);
  }

  opts.onProgress?.("Collecting results...");
  await sleep(POLL_INTERVAL_MS);

  const resolverIps = await pollCollector(token, fetchFn);

  let dnsServers: DnsServer[] = resolverIps.map((ip) => ({
    ip,
    country: null,
    countryCode: null,
    city: null,
    isp: null,
    asn: null,
    asOrg: null,
    leaked: false,
  }));

  if (opts.echoApiKey && resolverIps.length > 0) {
    opts.onProgress?.("Enriching resolver info...");
    const enriched = await enrichIps(resolverIps, opts.echoApiKey, fetchFn);
    dnsServers = dnsServers.map((s) => {
      const info = enriched.get(s.ip);
      if (!info) return s;
      return { ...s, ...info };
    });
  }

  const { verdict, servers } = determineVerdict(
    dnsServers,
    userCountryCode,
    opts.expectedResolvers,
    !!opts.echoApiKey,
  );

  const output: DnsLeakOutput = {
    token,
    rounds: opts.rounds,
    userIp,
    userCountry,
    userCountryCode,
    dnsServers: servers,
    count: servers.length,
    verdict,
  };

  const exitCode = verdict === "no_leak" ? 0 : verdict === "leak" ? 1 : 2;
  return { output, exitCode };
}
