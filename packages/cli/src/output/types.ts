import type { ProbeResult } from "../probes/types.js";
import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";

export type ProbeEntry = {
  name: string;
  category: string;
  method: "cftrace" | "http-header";
  target: string;
  resolvedTarget?: string;
  usedFallback: boolean;
} & ProbeResult;

export type ProbeSectionOutput = {
  results: ProbeEntry[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
  uniqueIps: UniqueIp[];
};

export type PingSectionOutput = {
  results: PingResult[];
};

export type OutputMode = "all" | "probe" | "ping";

export type FullOutput = {
  mode: OutputMode;
  probe: ProbeSectionOutput | null;
  ping: PingSectionOutput | null;
};
