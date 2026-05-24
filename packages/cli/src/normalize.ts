export type NormalizeSuccess = {
  ok: true;
  domain: string;
};

export type NormalizeError = {
  ok: false;
  message: string;
};

export type NormalizeResult = NormalizeSuccess | NormalizeError;

export function normalizeDomain(input: string): NormalizeResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: "Domain cannot be empty" };
  }

  const hasScheme = /^[a-z][a-z0-9+\-.]*:\/\//i.test(trimmed);

  if (hasScheme) {
    const schemeMatch = trimmed.match(/^([a-z][a-z0-9+\-.]*):\/\//i);
    const scheme = schemeMatch?.[1]?.toLowerCase();
    if (scheme && scheme !== "http" && scheme !== "https") {
      return {
        ok: false,
        message: `Unsupported scheme: ${scheme}. Only HTTP(S) domains are accepted.`,
      };
    }

    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return { ok: false, message: "Invalid URL format" };
    }

    if (url.port) {
      return {
        ok: false,
        message:
          "Custom ports not supported. Probe always uses HTTPS (port 443).",
      };
    }

    return { ok: true, domain: url.hostname };
  }

  // Bare domain — check for port
  const portMatch = trimmed.match(/:(\d+)(\/.*)?$/);
  if (portMatch) {
    return {
      ok: false,
      message:
        "Custom ports not supported. Probe always uses HTTPS (port 443).",
    };
  }

  // Strip trailing slashes and paths
  const domain = trimmed.split("/")[0]!;
  return { ok: true, domain };
}
