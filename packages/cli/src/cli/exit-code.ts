import type { ProbeResult } from "../probes/types.js";
import type { PingResult } from "../runner/ping-runner.js";

export function computeExitCode(
  mode: "all" | "connect" | "split",
  probeResults: ProbeResult[] | null,
  pingResults: PingResult[] | null,
): number {
  if (mode === "connect") {
    if (!pingResults || pingResults.length === 0) return 0;
    const succeeded = pingResults.filter((r) => r.ok).length;
    if (succeeded === pingResults.length) return 0;
    if (succeeded === 0) return 2;
    return 1;
  }

  // For "all" and "split" modes, exit code is based on probe results only
  if (!probeResults || probeResults.length === 0) return 0;
  const succeeded = probeResults.filter((r) => r.ok).length;
  if (succeeded === probeResults.length) return 0;
  if (succeeded === 0) return 2;
  return 1;
}
