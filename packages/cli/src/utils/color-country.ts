export function colorCountry(countryCode: string | null | undefined, noColor?: boolean): string {
  if (!countryCode) return "—";
  if (noColor) return countryCode;
  return `\x1b[36m${countryCode}\x1b[0m`;
}
