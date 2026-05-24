import { extractIpFromHeaders } from "../parsers/http-header.js";
import { classifyFetchError } from "./errors.js";
import type { ProbeOpts, ProbeResult } from "./types.js";

export async function probeHttpHeader(
  url: string,
  headerNames: string[],
  opts: ProbeOpts,
): Promise<ProbeResult> {
  const start = performance.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "HEAD",
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

  const result = extractIpFromHeaders(response.headers, headerNames);
  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      responseTimeMs,
    };
  }

  return {
    ok: true,
    ip: result.ip,
    location: null,
    colo: null,
    responseTimeMs,
  };
}
