import type { ProbeError } from "./types.js";

export function classifyFetchError(err: unknown, start: number): ProbeError {
  const elapsed = Math.round(performance.now() - start);
  const message = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? (err as { cause?: { code?: string } }).cause : undefined;
  const code = cause?.code ?? "";

  if (
    message.includes("TimeoutError") ||
    message.includes("timed out") ||
    message.includes("aborted due to timeout") ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    (err instanceof DOMException && err.name === "TimeoutError")
  ) {
    return { ok: false, code: "TIMEOUT", message: "Request timed out", responseTimeMs: elapsed };
  }

  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || message.includes("getaddrinfo")) {
    return { ok: false, code: "DNS_FAILED", message: "DNS resolution failed", responseTimeMs: null };
  }

  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    return { ok: false, code: "CONNECTION_REFUSED", message: "Connection refused", responseTimeMs: null };
  }

  if (code === "ECONNRESET" || code === "EHOSTDOWN" || code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return { ok: false, code: "CONNECTION_FAILED", message: `Connection failed (${code})`, responseTimeMs: null };
  }

  if (
    code === "ERR_TLS" ||
    code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    message.includes("TLS") ||
    message.includes("SSL") ||
    message.includes("certificate")
  ) {
    return { ok: false, code: "TLS_ERROR", message: `TLS error: ${code || message}`, responseTimeMs: null };
  }

  return { ok: false, code: "UNKNOWN", message, responseTimeMs: null };
}
