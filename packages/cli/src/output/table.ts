import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";
import type { ProbeEntry } from "./types.js";

type TableOpts = {
  noColor?: boolean;
};

export function formatProbeTable(
  entries: ProbeEntry[],
  uniqueIps: UniqueIp[],
  opts: TableOpts = {},
): string {
  if (entries.length === 0) {
    return "No endpoints configured.\n";
  }

  const lines: string[] = [];
  lines.push(bold("🔀 Split Tunnel Probe", opts));
  lines.push("━".repeat(72));
  lines.push(
    padRow(["Endpoint", "Location", "Colo", "Latency", "IP"]),
  );
  lines.push("─".repeat(72));

  for (const entry of entries) {
    if (entry.ok) {
      lines.push(
        padRow([
          `${colorize("✓", "green", opts)} ${entry.name}`,
          entry.location ?? "—",
          entry.colo ?? "—",
          colorizeLatency(entry.responseTimeMs, opts),
          entry.ip,
        ]),
      );
    } else {
      lines.push(
        padRow([
          `${colorize("✗", "red", opts)} ${entry.name}`,
          "—",
          "—",
          colorize(entry.error.code, "red", opts),
          "—",
        ]),
      );
    }
  }

  lines.push("─".repeat(72));

  const succeeded = entries.filter((e) => e.ok).length;
  const total = entries.length;

  const ipSummaryTable = formatIpSummaryTable(uniqueIps, opts);
  if (ipSummaryTable) lines.push("", ipSummaryTable);

  lines.push("─".repeat(72));
  const ipSummary = uniqueIps
    .map((u) => `${u.ip}${u.location ? ` (${u.location})` : ""}`)
    .join(", ");

  lines.push(
    `Summary: ${succeeded}/${total} succeeded${ipSummary ? ` | Unique IPs: ${ipSummary}` : ""}`,
  );

  return `${lines.join("\n")}\n`;
}

export function formatIpSummaryTable(
  uniqueIps: UniqueIp[],
  opts: TableOpts = {},
): string | null {
  const hasDetails = uniqueIps.some((u) => u.detail);
  if (!hasDetails) return null;

  const lines: string[] = [];
  lines.push(bold("🌐 IP Summary", opts));
  lines.push("─".repeat(72));
  lines.push(padIpRow(["IP", "Location", "Count", "ISP", "ASN"]));
  lines.push("─".repeat(72));
  for (const u of uniqueIps) {
    const d = u.detail;
    const loc = d
      ? [d.countryCode, d.province || d.city].filter(Boolean).join("/") || "—"
      : u.location ?? "—";
    lines.push(padIpRow([
      u.ip,
      loc,
      String(u.count),
      d?.isp ?? "—",
      d?.asn ? String(d.asn) : "—",
    ]));
  }
  return lines.join("\n");
}

export function formatPingTable(
  results: PingResult[],
  opts: TableOpts = {},
): string {
  if (results.length === 0) {
    return "No ping targets configured.\n";
  }

  const roundCount = results[0]?.rounds.length ?? 0;
  const lines: string[] = [];
  lines.push(bold(`🏓 Connectivity Test (median of ${roundCount} rounds)`, opts));
  lines.push("━".repeat(50));
  lines.push(padRow3(["Target", "Tag", "Latency"]));
  lines.push("─".repeat(50));

  for (const r of results) {
    if (r.ok) {
      lines.push(
        padRow3([
          `${colorize("✓", "green", opts)} ${r.name}`,
          r.tag,
          colorizeLatency(r.medianMs ?? 0, opts),
        ]),
      );
    } else {
      lines.push(
        padRow3([
          `${colorize("✗", "red", opts)} ${r.name}`,
          r.tag,
          colorize("FAILED", "red", opts),
        ]),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function padRow(cols: string[]): string {
  const widths = [20, 10, 6, 12, 0];
  return cols
    .map((c, i) => (i < cols.length - 1 ? c.padEnd(widths[i] ?? 0) : c))
    .join(" ");
}

function padRow3(cols: string[]): string {
  const widths = [22, 15, 10];
  return cols
    .map((c, i) => (i < cols.length - 1 ? c.padEnd(widths[i] ?? 0) : c))
    .join(" ");
}

function padIpRow(cols: string[]): string {
  const widths = [18, 12, 6, 20, 0];
  return cols
    .map((c, i) => (i < cols.length - 1 ? c.padEnd(widths[i] ?? 0) : c))
    .join(" ");
}

function bold(text: string, opts: TableOpts): string {
  if (opts.noColor) return text;
  return `\x1b[1m${text}\x1b[0m`;
}

function colorize(text: string, color: "red" | "green" | "yellow", opts: TableOpts): string {
  if (opts.noColor) return text;
  const codes = { red: "31", green: "32", yellow: "33" };
  return `\x1b[${codes[color]}m${text}\x1b[0m`;
}

function colorizeLatency(ms: number, opts: TableOpts): string {
  const text = `${ms}ms`;
  if (opts.noColor) return text;
  if (ms <= 200) return colorize(text, "green", opts);
  if (ms <= 1000) return colorize(text, "yellow", opts);
  return colorize(text, "red", opts);
}
