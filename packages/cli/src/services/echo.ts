export type IpInfo = {
  ip: string;
  country: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  isp: string | null;
  asn: number | null;
  asOrg: string | null;
};

type EchoResponse = {
  ip: string;
  location?: {
    country?: string;
    countryCode?: string;
    province?: string;
    city?: string;
    isp?: string;
    asn?: number;
    asOrg?: string;
  };
};

const ECHO_BASE_URL = "https://echo.nocoo.cloud/api/ip";
const TIMEOUT_MS = 5000;

export async function lookupIp(ip: string, apiKey: string): Promise<IpInfo | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${ECHO_BASE_URL}?ip=${encodeURIComponent(ip)}`, {
      headers: { "x-api-key": apiKey },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as EchoResponse;
    const loc = data.location;
    return {
      ip: data.ip,
      country: loc?.country ?? null,
      countryCode: loc?.countryCode ?? null,
      province: loc?.province ?? null,
      city: loc?.city ?? null,
      isp: loc?.isp ?? null,
      asn: loc?.asn ?? null,
      asOrg: loc?.asOrg ?? null,
    };
  } catch {
    return null;
  }
}

export async function lookupIps(
  ips: string[],
  apiKey: string,
  concurrency = 5,
): Promise<Map<string, IpInfo>> {
  const unique = [...new Set(ips)];
  const result = new Map<string, IpInfo>();
  let index = 0;

  async function worker() {
    while (index < unique.length) {
      const ip = unique[index++];
      if (!ip) break;
      const info = await lookupIp(ip, apiKey);
      if (info) result.set(ip, info);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unique.length) }, () => worker());
  await Promise.all(workers);
  return result;
}
