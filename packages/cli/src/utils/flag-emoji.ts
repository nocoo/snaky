export function flagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return "🌐";
  const offset = 0x1f1e6 - 0x41;
  const chars = countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint((c.codePointAt(0) ?? 0x41) + offset));
  return chars.join("");
}
