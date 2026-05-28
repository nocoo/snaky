export function displayWidth(text: string): number {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    width += isWide(cp) ? 2 : 1;
  }
  return width;
}

function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
    (cp >= 0x2e80 && cp <= 0x303e) || // CJK Radicals, Kangxi
    (cp >= 0x3041 && cp <= 0x33ff) || // Hiragana, Katakana, CJK symbols
    (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext A
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified
    (cp >= 0xa000 && cp <= 0xa4cf) || // Yi
    (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul Syllables
    (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility
    (cp >= 0xfe30 && cp <= 0xfe4f) || // CJK Compatibility Forms
    (cp >= 0xff00 && cp <= 0xff60) || // Fullwidth Forms
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd) // CJK Ext B+
  );
}

export function padDisplay(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

export function colorCountry(countryCode: string | null | undefined, noColor?: boolean): string {
  if (!countryCode) return "—";
  if (noColor) return countryCode;
  return `\x1b[36m${countryCode}\x1b[0m`;
}

export function colorCountryPad(text: string | null | undefined, width: number, noColor?: boolean): string {
  const raw = text ?? "—";
  const pad = " ".repeat(Math.max(0, width - displayWidth(raw)));
  if (noColor || raw === "—") return raw + pad;
  return `\x1b[36m${raw}\x1b[0m${pad}`;
}
