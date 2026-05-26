const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function ipToInt(ip: string): number | null {
  const m = IPV4_RE.exec(ip);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if (a > 255 || b > 255 || c > 255 || d > 255) return null;
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

export function matchesCidr(ip: string, cidr: string): boolean {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;

  const slashIdx = cidr.indexOf("/");
  let baseIp: string;
  let prefixLen: number;

  if (slashIdx === -1) {
    baseIp = cidr;
    prefixLen = 32;
  } else {
    baseIp = cidr.slice(0, slashIdx);
    prefixLen = Number(cidr.slice(slashIdx + 1));
    if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
  }

  const baseInt = ipToInt(baseIp);
  if (baseInt === null) return false;

  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

export function matchesAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some((cidr) => matchesCidr(ip, cidr));
}
