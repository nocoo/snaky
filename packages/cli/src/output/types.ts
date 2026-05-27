import type { DnsLeakOutput } from "../dns-leak/types.js";
import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";
import type { IpInfo } from "../services/echo.js";

export type IpDetail = IpInfo;

type ProbeEntryBase = {
  name: string;
  category: string;
  method: "cftrace" | "http-header";
  target: string;
  resolvedTarget?: string;
  usedFallback: boolean;
};

export type ProbeEntrySuccess = ProbeEntryBase & {
  ok: true;
  ip: string;
  location: string | null;
  colo: string | null;
  responseTimeMs: number;
};

export type ProbeEntryFailure = ProbeEntryBase & {
  ok: false;
  responseTimeMs: number | null;
  error: { code: string; message: string };
};

export type ProbeEntry = ProbeEntrySuccess | ProbeEntryFailure;

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

export type OutputMode = "all" | "connect" | "split" | "dns";

export type FullOutput = {
  mode: OutputMode;
  split: ProbeSectionOutput | null;
  connect: PingSectionOutput | null;
  dns: DnsLeakOutput | null;
  ipDetails?: IpDetail[];
};
