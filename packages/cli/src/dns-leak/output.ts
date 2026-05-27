import { colorCountry, colorCountryPad } from "../utils/color-country.js";
import type { DnsLeakOutput } from "./types.js";

export function formatDnsLeakTable(output: DnsLeakOutput, opts?: { noColor?: boolean }): string {
  const noColor = opts?.noColor;
  const lines: string[] = [];

  lines.push(`🛡️ DNS Leak Test (${output.rounds} rounds)`);
  lines.push("─".repeat(49));

  if (output.verdict === "inconclusive" && output.count === 0) {
    lines.push("");
    lines.push("No DNS resolvers detected. Possible causes:");
    lines.push("  - DNS queries are encrypted (DoH/DoT) and bypass recursive resolution");
    lines.push("  - Network connectivity issue");
    lines.push("  - DNS probe service temporarily unavailable");
    lines.push("");
    lines.push("Unable to determine leak status.");
    return lines.join("\n");
  }

  if (output.userIp) {
    const loc = output.userCountryCode ? ` (${colorCountry(output.userCountryCode, noColor)})` : "";
    lines.push(`Your IP: ${output.userIp}${loc}`);
  }

  lines.push("");
  lines.push("#  Resolver IP       ISP              Location    Status");

  for (let i = 0; i < output.dnsServers.length; i++) {
    const s = output.dnsServers[i];
    if (!s) continue;
    const num = String(i + 1).padEnd(2);
    const ip = s.ip.padEnd(17);
    const isp = (s.isp ?? "Unknown").slice(0, 16).padEnd(16);
    const loc = colorCountryPad(s.countryCode ?? "??", 11, noColor);
    const status = s.leaked ? "⚠ LEAK" : "✓ OK";
    lines.push(`${num} ${ip} ${isp} ${loc} ${status}`);
  }

  lines.push("");

  if (output.verdict === "no_leak") {
    lines.push(`✓ No DNS leak detected (${output.count} resolver${output.count !== 1 ? "s" : ""} found)`);
  } else if (output.verdict === "leak") {
    const leakedCount = output.dnsServers.filter((s) => s.leaked).length;
    lines.push(`⚠ DNS leak detected! ${leakedCount} of ${output.count} resolvers may be leaking`);
  } else {
    lines.push("Unable to determine leak status.");
  }

  return lines.join("\n");
}
