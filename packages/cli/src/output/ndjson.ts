import type { DnsLeakOutput } from "../dns-leak/types.js";
import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";
import type { FullOutput, IpDetail, ProbeEntry } from "./types.js";

export type NdjsonEvent =
  | { event: "meta"; data: { mode: "all" | "connect" | "split" | "dns"; version: string; counts: { split?: number; connect?: number; dns?: boolean } } }
  | { event: "probe.result"; data: ProbeEntry & { index: number } }
  | { event: "ping.result"; data: PingResult & { index: number } }
  | { event: "dns.progress"; data: { message: string } }
  | { event: "dns.update"; data: DnsLeakOutput }
  | { event: "ip.detail"; data: IpDetail }
  | { event: "unique.ip"; data: UniqueIp }
  | { event: "summary"; data: FullOutput }
  | { event: "error"; data: { code: string; message: string } }
  | { event: "done"; data: { exitCode: number } };

export type NdjsonWriter = {
  emit(event: NdjsonEvent): void;
};

export function createNdjsonWriter(stream: NodeJS.WritableStream): NdjsonWriter {
  return {
    emit(event) {
      stream.write(`${JSON.stringify(event)}\n`);
    },
  };
}
