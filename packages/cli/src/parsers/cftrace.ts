export type CfTraceSuccess = {
  ok: true;
  ip: string;
  location: string | null;
  colo: string | null;
};

export type CfTraceError = {
  ok: false;
  code: "PARSE_ERROR";
  message: string;
};

export type CfTraceResult = CfTraceSuccess | CfTraceError;

export function parseCfTrace(body: string): CfTraceResult {
  if (!body.trim()) {
    return { ok: false, code: "PARSE_ERROR", message: "Empty response body" };
  }

  const lines = body.split(/\r?\n/);
  const fields = new Map<string, string>();

  for (const line of lines) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields.set(key, value);
  }

  const ip = fields.get("ip");
  if (!ip) {
    return {
      ok: false,
      code: "PARSE_ERROR",
      message: "Missing ip field in cftrace response",
    };
  }

  return {
    ok: true,
    ip,
    location: fields.get("loc") ?? null,
    colo: fields.get("colo") ?? null,
  };
}
