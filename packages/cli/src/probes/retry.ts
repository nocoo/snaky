import type { ProbeResult } from "./types.js";

export type RetryOpts = {
  retries: number;
};

const BACKOFF_BASE_MS = 2000;

export async function withRetry(
  fn: () => Promise<ProbeResult>,
  opts: RetryOpts,
): Promise<ProbeResult> {
  let lastResult = await fn();
  if (lastResult.ok) return lastResult;

  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    await sleep(delay);
    lastResult = await fn();
    if (lastResult.ok) return lastResult;
  }

  return lastResult;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
