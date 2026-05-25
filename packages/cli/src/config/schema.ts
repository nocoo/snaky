const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const HEADER_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}
const KNOWN_KEYS = new Set([
  "endpoints",
  "pingTargets",
  "timeout",
  "pingTimeout",
  "concurrency",
  "retries",
  "pingRounds",
  "tier",
]);

export type ValidationSuccess = {
  ok: true;
  warnings: string[];
};

export type ValidationFailure = {
  ok: false;
  errors: string[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validateConfig(raw: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      warnings.push(`Unknown config key: ${key}`);
    }
  }

  if ("timeout" in raw) {
    validateInt(raw.timeout, "timeout", 100, 60000, errors);
  }
  if ("pingTimeout" in raw) {
    validateInt(raw.pingTimeout, "pingTimeout", 100, 10000, errors);
  }
  if ("concurrency" in raw) {
    validateInt(raw.concurrency, "concurrency", 1, 20, errors);
  }
  if ("retries" in raw) {
    validateInt(raw.retries, "retries", 0, 5, errors);
  }
  if ("pingRounds" in raw) {
    validateInt(raw.pingRounds, "pingRounds", 1, 30, errors);
  }
  if ("tier" in raw) {
    validateInt(raw.tier, "tier", 1, 9, errors);
  }

  const allNames = new Set<string>();

  if ("endpoints" in raw) {
    if (!Array.isArray(raw.endpoints)) {
      errors.push("endpoints must be an array");
    } else {
      for (const ep of raw.endpoints as Record<string, unknown>[]) {
        validateEndpoint(ep, allNames, errors);
      }
    }
  }

  if ("pingTargets" in raw) {
    if (!Array.isArray(raw.pingTargets)) {
      errors.push("pingTargets must be an array");
    } else {
      for (const pt of raw.pingTargets as Record<string, unknown>[]) {
        validatePingTarget(pt, allNames, errors);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, warnings };
}

function validateInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[],
): void {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return;
  }
  if (value < min || value > max) {
    errors.push(`${field} must be between ${min} and ${max}`);
  }
}

function validateEndpoint(
  ep: Record<string, unknown>,
  allNames: Set<string>,
  errors: string[],
): void {
  const name = ep.name as string | undefined;
  if (!name || typeof name !== "string") {
    errors.push("Endpoint missing name");
    return;
  }

  if (!NAME_RE.test(name)) {
    errors.push(
      `Invalid endpoint name "${name}": must match /^[a-z0-9][a-z0-9._-]{0,62}$/`,
    );
    return;
  }

  if (allNames.has(name)) {
    errors.push(`Duplicate endpoint name: "${name}"`);
    return;
  }
  allNames.add(name);

  if (ep.tier !== undefined) {
    validateInt(ep.tier, `Endpoint "${name}" tier`, 1, 9, errors);
  }

  const disabled = ep.disabled === true;
  const method = ep.method as string | undefined;

  if (disabled && !method) return;

  if (method && !["cftrace", "http-header"].includes(method)) {
    errors.push(`Invalid method "${method}" for endpoint "${name}"`);
    return;
  }

  if (!method || method === "cftrace") {
    if (!disabled && !ep.domain) {
      errors.push(`Endpoint "${name}" (cftrace) requires domain`);
    } else if (!disabled && typeof ep.domain === "string") {
      const domain = ep.domain;
      if (domain.includes("://")) {
        errors.push(`Endpoint "${name}" domain must not include scheme`);
      } else if (domain.includes(":")) {
        errors.push(`Endpoint "${name}" domain must not include port`);
      } else if (domain.includes("/")) {
        errors.push(`Endpoint "${name}" domain must not include path`);
      } else if (!DOMAIN_RE.test(domain)) {
        errors.push(`Endpoint "${name}" has invalid domain "${domain}"`);
      }
    }
  } else if (method === "http-header") {
    if (!disabled) {
      if (!ep.url || typeof ep.url !== "string") {
        errors.push(`Endpoint "${name}" (http-header) requires url`);
      } else if (!isValidHttpsUrl(ep.url)) {
        errors.push(
          `Endpoint "${name}" (http-header) url must be a valid HTTPS URL`,
        );
      }
      if (
        !ep.headers ||
        !Array.isArray(ep.headers) ||
        ep.headers.length === 0
      ) {
        errors.push(
          `Endpoint "${name}" (http-header) requires non-empty headers array`,
        );
      } else if (Array.isArray(ep.headers)) {
        for (const h of ep.headers as string[]) {
          if (typeof h !== "string" || !HEADER_NAME_RE.test(h)) {
            errors.push(
              `Endpoint "${name}" has invalid header name "${h}"`,
            );
          }
        }
      }
    }
  }
}

function validatePingTarget(
  pt: Record<string, unknown>,
  allNames: Set<string>,
  errors: string[],
): void {
  const name = pt.name as string | undefined;
  if (!name || typeof name !== "string") {
    errors.push("Ping target missing name");
    return;
  }

  if (!NAME_RE.test(name)) {
    errors.push(
      `Invalid ping target name "${name}": must match /^[a-z0-9][a-z0-9._-]{0,62}$/`,
    );
    return;
  }

  if (allNames.has(name)) {
    errors.push(`Duplicate endpoint name: "${name}"`);
    return;
  }
  allNames.add(name);

  const disabled = pt.disabled === true;
  if (!disabled) {
    if (!pt.url || typeof pt.url !== "string") {
      errors.push(`Ping target "${name}" requires url`);
    } else if (!isValidHttpsUrl(pt.url)) {
      errors.push(`Ping target "${name}" url must be a valid HTTPS URL`);
    }
  }

  if (pt.tier !== undefined) {
    validateInt(pt.tier, `Ping target "${name}" tier`, 1, 9, errors);
  }
}
