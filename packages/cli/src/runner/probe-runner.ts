import type { Endpoint } from "../config/types.js";
import type { ProbeResult } from "../probes/types.js";

export type RunnerOpts = {
  concurrency: number;
  probeFn: (endpoint: Endpoint) => Promise<ProbeResult>;
};

export async function runProbes(
  endpoints: Endpoint[],
  opts: RunnerOpts,
): Promise<ProbeResult[]> {
  if (endpoints.length === 0) return [];

  const results: ProbeResult[] = new Array(endpoints.length);
  let nextIdx = 0;

  async function worker(): Promise<void> {
    while (nextIdx < endpoints.length) {
      const idx = nextIdx++;
      results[idx] = await opts.probeFn(endpoints[idx]!);
    }
  }

  const workerCount = Math.min(opts.concurrency, endpoints.length);
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);

  return results;
}
