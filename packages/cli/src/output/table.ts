import type { ProbeEntry } from "./types.js";
import type { PingResult } from "../runner/ping-runner.js";
import type { UniqueIp } from "../runner/summary.js";

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
  lines.push(bold("Split Tunnel Probe", opts));
  lines.push("━".repeat(70));
  lines.push(
    padRow(["Endpoint", "Category", "IP", "Location", "Colo", "Latency"]),
  );
  lines.push("─".repeat(70));

  for (const entry of entries) {
    if (entry.ok) {
      lines.push(
        padRow([
          entry.name,
          entry.category,
          entry.ip,
          entry.location ?? "—",
          entry.colo ?? "—",
          `${entry.responseTimeMs}ms`,
        ]),
      );
    } else {
      lines.push(
        padRow([
          entry.name,
          entry.category,
          "—",
          "—",
          "—",
          colorize(entry.code, "red", opts),
        ]),
      );
    }
  }

  lines.push("─".repeat(70));

  const succeeded = entries.filter((e) => e.ok).length;
  const total = entries.length;
  const ipSummary = uniqueIps
    .map((u) => `${u.ip}${u.location ? ` (${u.location})` : ""}`)
    .join(", ");

  lines.push(
    `Summary: ${succeeded}/${total} succeeded${ipSummary ? ` | Unique IPs: ${ipSummary}` : ""}`,
  );

  return lines.join("\n") + "\n";
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
  lines.push(bold(`Connectivity Test (median of ${roundCount} rounds)`, opts));
  lines.push("━".repeat(45));
  lines.push(padRow3(["Target", "Tag", "Latency"]));
  lines.push("─".repeat(45));

  for (const r of results) {
    if (r.ok) {
      lines.push(padRow3([r.name, r.tag, `${r.medianMs}ms`]));
    } else {
      lines.push(
        padRow3([r.name, r.tag, colorize("FAILED", "red", opts)]),
      );
    }
  }

  return lines.join("\n") + "\n";
}

function padRow(cols: string[]): string {
  const widths = [16, 10, 16, 9, 5, 10];
  return cols.map((c, i) => c.padEnd(widths[i]!)).join(" ");
}

function padRow3(cols: string[]): string {
  const widths = [17, 15, 10];
  return cols.map((c, i) => c.padEnd(widths[i]!)).join(" ");
}

function bold(text: string, opts: TableOpts): string {
  if (opts.noColor) return text;
  return `\x1b[1m${text}\x1b[0m`;
}

function colorize(text: string, color: "red" | "green", opts: TableOpts): string {
  if (opts.noColor) return text;
  const code = color === "red" ? "31" : "32";
  return `\x1b[${code}m${text}\x1b[0m`;
}
