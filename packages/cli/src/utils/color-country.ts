export function colorCountry(countryCode: string | null | undefined, noColor?: boolean): string {
  if (!countryCode) return "—";
  if (noColor) return countryCode;
  return `\x1b[36m${countryCode}\x1b[0m`;
}

export function colorCountryPad(text: string | null | undefined, width: number, noColor?: boolean): string {
  const raw = text ?? "—";
  if (noColor || raw === "—") return raw.padEnd(width);
  return `\x1b[36m${raw}\x1b[0m${" ".repeat(Math.max(0, width - raw.length))}`;
}
