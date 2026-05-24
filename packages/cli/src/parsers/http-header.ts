import { isValidIp } from "../validators/ip.js";

export type HeaderSuccess = {
  ok: true;
  ip: string;
};

export type HeaderError = {
  ok: false;
  code: "HEADER_MISSING" | "PARSE_ERROR";
  message: string;
};

export type HeaderResult = HeaderSuccess | HeaderError;

export function extractIpFromHeaders(
  headers: Headers,
  headerNames: string[],
): HeaderResult {
  for (const name of headerNames) {
    const value = headers.get(name);
    if (value === null || value.trim() === "") continue;

    const trimmed = value.trim();

    if (trimmed.includes(",")) {
      return {
        ok: false,
        code: "PARSE_ERROR",
        message: `Invalid IP format in header ${name}: contains multiple values`,
      };
    }

    if (!isValidIp(trimmed)) {
      return {
        ok: false,
        code: "PARSE_ERROR",
        message: `Invalid IP format in header ${name}: not a valid IP literal`,
      };
    }

    return { ok: true, ip: trimmed };
  }

  return {
    ok: false,
    code: "HEADER_MISSING",
    message: `None of the expected headers found: ${headerNames.join(", ")}`,
  };
}
