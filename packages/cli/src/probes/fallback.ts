import { probeCftrace } from "./cftrace.js";
import { withRetry } from "./retry.js";
import type { ProbeResult } from "./types.js";

export type FallbackOpts = {
  timeout: number;
  retries: number;
};

export type FallbackResult = {
  result: ProbeResult;
  usedFallback: boolean;
};

export async function probeWithFallback(
  primaryBaseUrl: string,
  fallbackBaseUrl: string | undefined,
  opts: FallbackOpts,
): Promise<FallbackResult> {
  if (!fallbackBaseUrl) {
    const result = await withRetry(
      () => probeCftrace(primaryBaseUrl, { timeout: opts.timeout }),
      { retries: opts.retries },
    );
    return { result, usedFallback: false };
  }

  // Primary gets one shot only
  const primaryResult = await probeCftrace(primaryBaseUrl, {
    timeout: opts.timeout,
  });
  if (primaryResult.ok) {
    return { result: primaryResult, usedFallback: false };
  }

  // Fallback gets full retry budget
  const fallbackResult = await withRetry(
    () => probeCftrace(fallbackBaseUrl, { timeout: opts.timeout }),
    { retries: opts.retries },
  );

  if (fallbackResult.ok) {
    return { result: fallbackResult, usedFallback: true };
  }

  return { result: fallbackResult, usedFallback: false };
}
