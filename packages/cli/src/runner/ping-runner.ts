import type { PingTarget } from "../config/types.js";

export type PingRunnerOpts = {
  rounds: number;
  pingTimeout: number;
  concurrency: number;
  pingFn: (url: string, opts: { timeout: number }) => Promise<number>;
  onResult?: (index: number, result: PingResult) => void;
};

export type PingResult = {
  name: string;
  tag: string;
  ok: boolean;
  medianMs: number | null;
  rounds: number[];
  error?: { code: string; message: string };
};

export async function runPing(
  targets: PingTarget[],
  opts: PingRunnerOpts,
): Promise<PingResult[]> {
  if (targets.length === 0) return [];

  const roundResults: number[][] = targets.map(() => []);

  // Warmup round (concurrent, results discarded)
  await runRound(targets, opts);

  // Measured rounds (sequential)
  for (let round = 0; round < opts.rounds; round++) {
    const results = await runRound(targets, opts);
    for (let i = 0; i < targets.length; i++) {
      const roundMs = results[i] ?? -1;
      roundResults[i]?.push(roundMs);
    }
  }

  const finalResults = targets.map((target, i) => {
    const rounds = roundResults[i] ?? [];
    const successful = rounds.filter((r) => r >= 0).sort((a, b) => a - b);

    if (successful.length === 0) {
      return {
        name: target.name,
        tag: target.tag,
        ok: false,
        medianMs: null,
        rounds,
        error: {
          code: "ALL_FAILED",
          message: `All ${rounds.length} rounds failed`,
        },
      };
    }

    return {
      name: target.name,
      tag: target.tag,
      ok: true,
      medianMs: median(successful),
      rounds,
    };
  });

  for (let i = 0; i < finalResults.length; i++) {
    const result = finalResults[i];
    if (result) opts.onResult?.(i, result);
  }

  return finalResults;
}

async function runRound(
  targets: PingTarget[],
  opts: PingRunnerOpts,
): Promise<number[]> {
  const results = await Promise.all(
    targets.map((t) => opts.pingFn(t.url, { timeout: opts.pingTimeout })),
  );
  return results;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}
