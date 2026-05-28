export type ProbeSuccess = {
  ok: true;
  ip: string;
  location: string | null;
  colo: string | null;
  responseTimeMs: number;
};

export type ProbeError = {
  ok: false;
  code:
    | "TIMEOUT"
    | "DNS_FAILED"
    | "CONNECTION_REFUSED"
    | "CONNECTION_FAILED"
    | "TLS_ERROR"
    | "HTTP_ERROR"
    | "PARSE_ERROR"
    | "REDIRECT"
    | "HEADER_MISSING"
    | "UNKNOWN";
  message: string;
  responseTimeMs: number | null;
};

export type ProbeResult = ProbeSuccess | ProbeError;

export type ProbeOpts = {
  timeout: number;
  signal?: AbortSignal;
};
