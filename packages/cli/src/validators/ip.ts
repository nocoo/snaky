import { isIP } from "node:net";

export function isValidIp(value: string): boolean {
  if (!value || value.includes("[") || value.includes("]")) return false;

  const colonCount = value.split(":").length - 1;
  if (colonCount === 1) {
    const parts = value.split(":");
    if (parts[1] && /^\d+$/.test(parts[1])) return false;
  }

  return isIP(value) !== 0;
}
