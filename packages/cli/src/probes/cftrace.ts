import { parseCfTrace } from "../parsers/cftrace.js";
import { classifyFetchError } from "./errors.js";
import type { ProbeOpts, ProbeResult } from "./types.js";

export async function probeCftrace(
  baseUrl: string,
  opts: ProbeOpts,
  path = "/cdn-cgi/trace",
): Promise<ProbeResult> {
  const url = `${baseUrl}${path}`;
  const start = performance.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeout),
    });
  } catch (err) {
    return classifyFetchError(err, start);
  }

  const responseTimeMs = Math.round(performance.now() - start);

  const status = response.status;
  if (status >= 300 && status < 400) {
    return {
      ok: false,
      code: "REDIRECT",
      message: `Server responded with ${status} redirect`,
      responseTimeMs,
    };
  }

  if (status < 200 || status >= 300) {
    return {
      ok: false,
      code: "HTTP_ERROR",
      message: `HTTP ${status}`,
      responseTimeMs,
    };
  }

  const body = await response.text();
  const parsed = parseCfTrace(body);

  if (!parsed.ok) {
    return {
      ok: false,
      code: "PARSE_ERROR",
      message: parsed.message,
      responseTimeMs,
    };
  }

  return {
    ok: true,
    ip: parsed.ip,
    location: parsed.location,
    colo: parsed.colo,
    responseTimeMs,
  };
}
