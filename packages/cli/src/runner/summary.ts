import type { ProbeResult } from "../probes/types.js";

export type UniqueIp = {
  ip: string;
  location: string | null;
  count: number;
};

export function buildUniqueSummary(results: ProbeResult[]): UniqueIp[] {
  const map = new Map<string, { location: string | null; count: number }>();

  for (const r of results) {
    if (!r.ok) continue;
    const existing = map.get(r.ip);
    if (existing) {
      existing.count++;
    } else {
      map.set(r.ip, { location: r.location, count: 1 });
    }
  }

  return Array.from(map.entries())
    .map(([ip, { location, count }]) => ({ ip, location, count }))
    .sort((a, b) => b.count - a.count);
}
