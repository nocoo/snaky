# Snaky — IP Routing Probe & Latency Tester

## Objective

A developer utility for probing outbound IP addresses and measuring latency to various endpoints. Useful for verifying IP routing rules (split tunneling, proxy chains, VPN configurations) by hitting multiple detection endpoints across different domains and methods.

**Target users:** Developers and network engineers who configure proxy/VPN split routing and need fast feedback on which IP exits where.

**Core value:** One command shows your exit IP and latency for each configured endpoint, instantly revealing routing misconfigurations.

## Architecture

```
snaky/
├── packages/
│   └── cli/              # @nocoo/snaky — npm package
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   └── macos/            # SwiftUI menu bar app
│       ├── Snaky/
│       └── Snaky.xcodeproj
├── pnpm-workspace.yaml
├── package.json          # root workspace config
├── tsconfig.base.json
└── SPEC.md
```

**Monorepo:** pnpm workspace  
**CLI ↔ App relationship:** macOS app shells out to the installed `snaky` CLI binary and renders its JSON output. No shared library — CLI is the single source of truth for probe logic.

## CLI (`@nocoo/snaky`)

### Tech Stack

| Layer         | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| Language      | TypeScript (strict)                                           |
| Runtime       | Node.js >= 20                                                 |
| Build         | tsup (ESM output)                                             |
| HTTP client   | undici (built-in fetch)                                       |
| CLI framework | None (minimal arg parsing with `parseArgs` from `node:util`)  |
| Output        | Colored table (stdout), JSON (--json flag)                    |

### Commands

```
snaky                       # Run all: split-tunnel probe + connectivity test
snaky probe [name...]       # Probe specific named endpoints only (IP detection)
snaky ping                  # Connectivity test only (latency to key services)
snaky list                  # List all endpoints (source: built-in / user / disabled)
snaky add <name> <domain>   # Add cftrace endpoint (shorthand, most common)
snaky add <name> --method http-header --url <url> --header <header-name>
                            # Add http-header endpoint
snaky add <name> --method http-ping --url <url>
                            # Add http-ping endpoint
snaky remove <name>         # Remove a user-added endpoint or user override
snaky disable <name>        # Suppress an endpoint (see "disable semantics" below)
snaky enable <name>         # Re-enable a previously disabled endpoint
snaky config path           # Print config file path (read-only, never creates file)
snaky config show           # Print effective config (read-only, never creates file)
snaky config init           # Create config file with default settings (if not exists)
```

**`snaky` (no subcommand)** runs both probe and ping in parallel, displays results in two sections.

### Global Flags

| Flag            | Description                                              |
| --------------- | -------------------------------------------------------- |
| `--json`        | Output JSON to stdout (table suppressed)                 |
| `--timeout <ms>`| Per-endpoint timeout, overrides config (default: 5000)   |
| `--concurrency <n>` | Max parallel requests (default: 10)                 |
| `--config <path>` | Use custom config file                                |
| `--no-color`    | Disable colored output                                   |
| `--category <cat>` | Filter probe endpoints by category (e.g., `ai`, `domestic`) |
| `--version`     | Print version and exit                                   |
| `--help`        | Print usage and exit                                     |

### stdout / stderr Rules

- **stdout:** Only structured output (table or JSON). Never mix.
- **stderr:** Human-readable logs, warnings, progress indicators.
- In `--json` mode, errors are embedded in the JSON structure (see "Error Contract" below), never printed to stdout as free text. stderr may still carry warnings (e.g., "config file not found, using defaults").

---

## Probe Methods

The CLI supports **3 distinct probe methods** for detecting exit IP addresses. Each built-in endpoint specifies which method to use.

### Method 1: `cftrace` (Cloudflare Trace)

The primary method. Works on any domain fronted by Cloudflare.

**Request:** `GET https://{domain}/cdn-cgi/trace` with `{ redirect: "manual" }`  
**Response:** Plain text, key=value per line  
**Extracts:**
- `ip=` → exit IP address
- `loc=` → country code (uppercase ISO 3166-1 alpha-2, as returned by Cloudflare)
- `colo=` → Cloudflare datacenter code (IATA, uppercase)

**Fallback domain:** Some endpoints define a `fallbackDomain`. If the primary domain fails (any error), retry with the fallback before reporting error.

### Method 2: `http-header` (Response Header Inspection)

For CDN providers that expose the client IP in a response header (not Cloudflare-based).

**Request:** `HEAD {url}` with `{ redirect: "manual" }`  
**Response:** Read specific header(s) for the client IP  
**Configuration per endpoint:**
- `url`: full URL to request
- `headers`: ordered list of header names to check (first non-empty wins)

**Header value parsing (strict):**
- The header value MUST be a single valid IPv4 or IPv6 literal (e.g., `1.2.3.4` or `2001:db8::1`)
- Values containing commas (e.g., `1.2.3.4, 5.6.7.8`), ports (`1.2.3.4:8080`), JSON, or other formats → `PARSE_ERROR`
- Leading/trailing whitespace is trimmed before validation

**Examples:**
- Netease CDN: `HEAD https://necaptcha.nosdn.127.net/...` → header `cdn-user-ip`
- Bytedance CDN: `HEAD https://perfops.byte-test.com/...` → headers `x-request-ip`, `x-response-cinfo`

**Extracts:** IP address only. `location` and `colo` are always `null` for this method — the CLI does NOT perform GeoIP lookups.

### Method 3: `http-ping` (Connectivity & Latency Only)

For connectivity tests where we only care about reachability and latency, not the exit IP.

**Request:** `GET {url}` with `{ redirect: "manual" }`  
**Success criteria:** Any HTTP response received — including non-2xx status codes (204, 403, etc.). The `HTTP_ERROR` code does NOT apply to this method.  
**Extracts:** `responseTimeMs` only — no IP, no geo.

**Used for:** `snaky ping` targets (GitHub generate_204, YouTube generate_204, Taobao favicon, etc.)

---

## Probe Logic (Unified)

For all methods:
1. Record start time
2. Execute HTTP request per method spec, with `{ redirect: "manual" }`
3. Record `responseTimeMs`: wall-clock duration from `fetch()` call to response headers received (includes DNS + TCP + TLS + server processing; excludes body read time)
4. For `cftrace`: read body and parse key=value pairs
5. For `http-header`: read specified response header(s), validate as IP literal
6. For `http-ping`: response received = success (no body/header parsing)
7. Return structured result

**`responseTimeMs` is always the header-arrival timestamp** — even when `PARSE_ERROR` occurs after reading the body. This gives a consistent measurement point across all methods and error types. It represents network latency, not total processing time.

**Why `responseTimeMs` not "TTFB":** TTFB has ambiguous definitions across tools (some exclude DNS, some include body). We define it precisely as above and name it unambiguously.

### Retry Policy

**Applies to: IP detection probes (`cftrace`, `http-header`) ONLY.**

- Failed probes are retried up to `retries` times (default: 2) with exponential backoff (2s, 4s delay)
- Retries are per-endpoint and do not block other endpoints
- The retry count is "in-flight slots" — a retrying endpoint does NOT release its concurrency slot during backoff wait (it holds the slot until final success/failure)

**Does NOT apply to:** `http-ping` rounds. Each ping round is independent — a timed-out round is recorded as `-1` and the next round proceeds immediately. No retry.

### Timing Bounds

**Worst-case single endpoint duration (IP probe):**
```
timeout × (retries + 1) + backoff_sum
= 5000 × 3 + (2000 + 4000) = 21000ms (21s)
```

**Worst-case total CLI execution time:**
```
(total_endpoints / concurrency) × worst_case_single + ping_warmup + (pingRounds × pingTimeout)
```

With defaults (28 endpoints, concurrency=10, 2 retries, 12 ping rounds):
- Probes: ceil(28/10) × 21s = 63s worst case (all timeout + all retry)
- Ping: 3s warmup + 12 × 3s = 39s
- Total: ~63s (probes and ping run in parallel; probes dominate)
- **Typical (no retries):** ~5–8s

### Concurrency Model

The `concurrency` setting limits **active HTTP requests** (in-flight fetch calls). Endpoints waiting in backoff between retries count as "occupied" — they hold their slot.

---

## Built-in Endpoints

All built-in endpoints are hardcoded in source. Organized by category for filtering (`--category`).

### Category: `domestic` (国内)

| Name             | Method        | Target                                                                 |
| ---------------- | ------------- | ---------------------------------------------------------------------- |
| `netease`        | `http-header` | HEAD `https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png` → header: `cdn-user-ip` |
| `bytedance`      | `http-header` | HEAD `https://perfops.byte-test.com/500b-bench.jpg` → headers: `x-request-ip`, `x-response-cinfo` |
| `qualcomm-cn`    | `cftrace`     | domain: `www.qualcomm.cn` (Cloudflare China network)                   |

### Category: `ai` (AI Services)

| Name             | Method    | Target                        |
| ---------------- | --------- | ----------------------------- |
| `anthropic`      | `cftrace` | domain: `anthropic.com`       |
| `claude`         | `cftrace` | domain: `claude.ai`           |
| `chatgpt`        | `cftrace` | domain: `chatgpt.com`         |
| `openai`         | `cftrace` | domain: `openai.com`          |
| `sora`           | `cftrace` | domain: `sora.com`            |
| `grok`           | `cftrace` | domain: `grok.com`            |
| `perplexity`     | `cftrace` | domain: `www.perplexity.ai`   |
| `midjourney`     | `cftrace` | domain: `midjourney.com`      |

### Category: `social` (Social & Communication)

| Name             | Method    | Target                                                     |
| ---------------- | --------- | ---------------------------------------------------------- |
| `discord`        | `cftrace` | domain: `discord.com`, fallbackDomain: `gateway.discord.gg` |
| `x`              | `cftrace` | domain: `x.com`                                            |
| `medium`         | `cftrace` | domain: `medium.com`                                       |

### Category: `crypto` (Cryptocurrency)

| Name             | Method    | Target                   |
| ---------------- | --------- | ------------------------ |
| `coinbase`       | `cftrace` | domain: `coinbase.com`   |
| `okx`            | `cftrace` | domain: `www.okx.com`    |

### Category: `tools` (Productivity & Services)

| Name             | Method    | Target                      |
| ---------------- | --------- | --------------------------- |
| `zoom`           | `cftrace` | domain: `zoom.us`           |
| `1password`      | `cftrace` | domain: `1password.com`     |
| `wise`           | `cftrace` | domain: `wise.com`          |
| `godaddy`        | `cftrace` | domain: `godaddy.com`       |
| `producthunt`    | `cftrace` | domain: `producthunt.com`   |

### Category: `dev` (Developer & CDN)

| Name             | Method        | Target                                                                 |
| ---------------- | ------------- | ---------------------------------------------------------------------- |
| `cloudflare`     | `cftrace`     | domain: `www.cloudflare.com`                                           |
| `cdnjs`          | `cftrace`     | domain: `cdnjs.cloudflare.com`                                         |
| `npm`            | `cftrace`     | domain: `registry.npmjs.org`                                           |
| `unpkg`          | `cftrace`     | domain: `unpkg.com`                                                    |
| `nodejs`         | `cftrace`     | domain: `nodejs.org`                                                   |
| `gitlab`         | `cftrace`     | domain: `gitlab.com`                                                   |
| `kali`           | `cftrace`     | domain: `kali.download`                                                |
| `bytedance-intl` | `http-header` | HEAD `https://perfops2.byte-test.com/500b-bench.jpg` → headers: `x-request-ip`, `x-response-cinfo` |

### Category: `media` (Streaming & Media)

| Name             | Method    | Target                      |
| ---------------- | --------- | --------------------------- |
| `crunchyroll`    | `cftrace` | domain: `crunchyroll.com`   |

### Connectivity Targets (for `snaky ping`)

These use the `http-ping` method — latency measurement only, no IP extraction.

| Name             | URL                                                          | Tag      |
| ---------------- | ------------------------------------------------------------ | -------- |
| `ping-bytedance` | `https://perfops.byte-test.com/500b-bench.jpg`              | domestic |
| `ping-taobao`    | `https://www.taobao.com/favicon.ico`                        | domestic |
| `ping-wechat`    | `https://res.wx.qq.com/a/wx_fed/assets/res/NTI4MWU5.ico`   | domestic |
| `ping-github`    | `https://github.com/generate_204`                           | international |
| `ping-cloudflare`| `https://1.1.1.1/cdn-cgi/trace`                            | international |
| `ping-youtube`   | `https://www.youtube.com/generate_204`                      | international |

**Connectivity test behavior:**
- Runs 1 warmup round (hidden, establishes TCP+TLS) + 12 measured rounds per target
- Reports **median** latency (not average — resistant to outliers)
- All targets probed concurrently within each round; rounds are sequential
- Per-round timeout: 3000ms (shorter than IP probe timeout)
- Individual round timeout does NOT trigger retry — recorded as -1 and next round starts
- Results include per-round history for sparkline/dot visualization in macOS app

### Built-in Endpoint Maintenance

Built-in endpoints reference third-party services that may change or go offline. Rules for maintenance:

- **Each built-in endpoint MUST have a mock fixture** in the test suite that simulates its expected response. Tests never hit real network.
- **Live validation** (optional, non-blocking): a separate `test:live` script can be run manually or in a scheduled CI job (not on every PR) to verify endpoints are still responding. Failures are logged as warnings, not CI-blocking errors.
- **Deprecation process:** If a built-in endpoint is confirmed dead (>30 days of `test:live` failure or domain sold/decommissioned):
  1. Move it to a `deprecated` category (excluded from default probe, still available by name)
  2. After one release cycle: remove from source entirely
  3. Document removal in CHANGELOG
- **Adding new built-in endpoints** requires: mock fixture + confirmation that the domain actually has the expected probe method (cftrace response, or header present).

---

## Endpoint Definition (for user-added endpoints)

User-added endpoints (`snaky add`) support all 3 methods:

```
snaky add <name> <domain>
    # Adds a cftrace endpoint. <domain> is normalized (see below).

snaky add <name> --method http-header --url <url> --header <header-name>
    # Adds an http-header endpoint. --header can be repeated for multiple headers.

snaky add <name> --method http-ping --url <url>
    # Adds an http-ping endpoint (connectivity test target).
```

**No mixed-argument form.** The positional `<domain>` argument is only valid for cftrace (the shorthand). For other methods, `--method` is required and `<domain>` positional is forbidden (error if both present).

### URL / Domain Normalization (for cftrace method)

- Accept bare domain: `openai.com` → stored as `openai.com`
- Accept full URL: `https://openai.com` or `https://openai.com/cdn-cgi/trace` → normalized to `openai.com`
- Auto-reject non-HTTP(S) schemes (ftp://, file://, etc.) with error
- Strip trailing slashes and paths
- Probe URL construction: `https://{stored_domain}/cdn-cgi/trace`

### Validation for http-header / http-ping methods

- `url`: must be a valid HTTPS URL (HTTP rejected with error)
- `--header` (http-header only): required at least once, must be a valid HTTP header name (RFC 7230)
- Multiple `--header` flags: stored as ordered array, checked in order at probe time

---

## Default Endpoints Strategy

**Built-in defaults** are hardcoded in source (not in config file). They are always present unless explicitly disabled.

**Merge rules:**
- Effective endpoint list = built-in defaults + user-added endpoints − disabled entries
- **Name collision:** If a user adds an endpoint with the same name as a built-in, the user entry takes precedence (overrides the built-in)
- **`snaky list`** shows source column: `built-in` | `user` | `disabled`

**`snaky remove` behavior:**
- Target is a user-added endpoint (no built-in with same name) → delete it from config
- Target is a user override of a built-in (same name exists in built-in) → delete the override, built-in resurfaces
- Target is a pure built-in (no user entry) → error: "Cannot remove built-in endpoint. Use `snaky disable <name>` to suppress it."
- Target does not exist → error: "Endpoint '<name>' not found"

**`snaky disable <name>` / `snaky enable <name>`:**

Disable/enable works on BOTH built-in and user-added endpoints:
- **Disabling a built-in:** Adds `{ "name": "<name>", "disabled": true }` to config — suppresses the built-in
- **Disabling a user endpoint:** Sets `"disabled": true` on the existing user config entry. The full endpoint configuration is preserved (not replaced by a tombstone), so `enable` restores it intact.
- **Enabling:** Sets `"disabled": false` (or removes the `disabled` key) on the config entry. If the entry was a pure tombstone for a built-in, it is removed from config entirely.
- Idempotent: `disable` on already-disabled → no-op; `enable` on already-enabled → no-op

---

## Output Formats

### JSON (`--json` flag)

**Top-level structure — always present regardless of run mode:**
```json
{
  "mode": "all",
  "probe": { ... },
  "ping": { ... }
}
```

**`mode` field values:**
| Value     | When                          | `probe`  | `ping`   |
| --------- | ----------------------------- | -------- | -------- |
| `"all"`   | `snaky` (no subcommand)       | present  | present  |
| `"probe"` | `snaky probe [name...]`       | present  | `null`   |
| `"ping"`  | `snaky ping`                  | `null`   | present  |

This guarantees consumers always know which sections to expect without guessing.

**Probe section:**
```json
{
  "results": [ ...probe entries... ],
  "summary": {
    "total": 28,
    "succeeded": 25,
    "failed": 3
  },
  "uniqueIps": [
    { "ip": "203.0.113.42", "location": "HK", "count": 20 },
    { "ip": "198.51.100.7", "location": "US", "count": 3 },
    { "ip": "10.0.0.1", "location": null, "count": 2 }
  ]
}
```

**Ping section:**
```json
{
  "results": [ ...ping entries... ]
}
```

---

### Probe Entry Schema

**Country code convention:** Uppercase ISO 3166-1 alpha-2 (e.g., `"HK"`, `"US"`, `"CN"`). This matches Cloudflare's `loc` field output directly — no transformation needed.

**Success entry (cftrace):**
```json
{
  "name": "openai",
  "category": "ai",
  "method": "cftrace",
  "target": "openai.com",
  "ok": true,
  "ip": "203.0.113.42",
  "location": "HK",
  "colo": "HKG",
  "responseTimeMs": 45,
  "usedFallback": false
}
```

**Success entry (cftrace with fallback used):**
```json
{
  "name": "discord",
  "category": "social",
  "method": "cftrace",
  "target": "discord.com",
  "resolvedTarget": "gateway.discord.gg",
  "ok": true,
  "ip": "198.51.100.7",
  "location": "US",
  "colo": "LAX",
  "responseTimeMs": 180,
  "usedFallback": true
}
```

**Success entry (http-header — no location, no colo):**
```json
{
  "name": "netease",
  "category": "domestic",
  "method": "http-header",
  "target": "https://necaptcha.nosdn.127.net/ab7f4275c1744aa28e0a8f3a1c58c532.png",
  "ok": true,
  "ip": "10.0.0.1",
  "location": null,
  "colo": null,
  "responseTimeMs": 12,
  "usedFallback": false
}
```

**`location` is `null`** for `http-header` method — the CLI does NOT perform GeoIP lookups. Only `cftrace` provides location data (from CF's `loc` field). The macOS app or web frontend may enrich with GeoIP separately.

**Failure entry:**
```json
{
  "name": "example",
  "category": "user",
  "method": "cftrace",
  "target": "example.com",
  "ok": false,
  "responseTimeMs": 5003,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timed out after 5000ms"
  },
  "usedFallback": false
}
```

**`responseTimeMs` in failure entries:**
- Always present when measurable (TIMEOUT, HTTP_ERROR, PARSE_ERROR, REDIRECT, HEADER_MISSING) — shows elapsed time at point of failure detection (header-arrival time)
- Absent (`undefined`) only when no connection was established (DNS_FAILED, CONNECTION_REFUSED, TLS_ERROR)

**`target` vs `resolvedTarget`:**
- `target`: the configured domain/URL (always present)
- `resolvedTarget`: only present when `usedFallback: true` — shows the fallback domain that was actually used
- `responseTimeMs`: always refers to the **successful or final** request only (not cumulative across primary + fallback attempts)

---

### Ping Entry Schema

**Success:**
```json
{
  "name": "ping-github",
  "tag": "international",
  "ok": true,
  "medianMs": 85,
  "rounds": [92, 88, 85, 84, 86, 85, 83, 87, 85, 84, 86, 85]
}
```

**Failure (all rounds timed out):**
```json
{
  "name": "ping-youtube",
  "tag": "international",
  "ok": false,
  "medianMs": null,
  "rounds": [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  "error": { "code": "ALL_TIMEOUT", "message": "All 12 rounds timed out" }
}
```

**Partial success (some rounds timed out):**
```json
{
  "name": "ping-wechat",
  "tag": "domestic",
  "ok": true,
  "medianMs": 15,
  "rounds": [18, -1, 15, 14, 16, -1, 15, 14, 15, 16, 14, 15]
}
```

(`-1` in rounds array = that round timed out. `ok: true` if at least 1 round succeeded. `medianMs` computed from successful rounds only.)

---

### Error Codes

| Code                 | Applies to                  | Meaning                                    |
| -------------------- | --------------------------- | ------------------------------------------ |
| `TIMEOUT`            | cftrace, http-header        | No response within configured timeout      |
| `DNS_FAILED`         | cftrace, http-header        | Domain resolution failed                   |
| `CONNECTION_REFUSED` | cftrace, http-header        | TCP connection refused                     |
| `TLS_ERROR`          | cftrace, http-header        | TLS handshake failure                      |
| `HTTP_ERROR`         | cftrace, http-header        | Non-2xx status (includes status in message)|
| `PARSE_ERROR`        | cftrace, http-header        | Response body/header not valid format      |
| `REDIRECT`           | cftrace, http-header        | Server responded with 3xx redirect         |
| `HEADER_MISSING`     | http-header                 | Expected IP header not present in response |
| `ALL_TIMEOUT`        | http-ping                   | All ping rounds timed out                  |
| `UNKNOWN`            | all                         | Unexpected error                           |

**Note:** `HTTP_ERROR` does NOT apply to `http-ping` — any HTTP response (including 403, 204, etc.) counts as successful connectivity for ping purposes. Only network-level failures (timeout, DNS, connection refused, TLS) cause ping round failure.

---

### Exit Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 0    | All probes succeeded           |
| 1    | Some probes failed (partial)   |
| 2    | All probes failed              |
| 3    | Fatal error (bad config, etc.) |

**JSON completeness guarantee:** When `--json` is active, exit codes 0, 1, and 2 ALL produce valid, complete JSON on stdout. The macOS app can safely parse stdout regardless of exit code (0–2). Only exit code 3 may produce no stdout (fatal error before probing starts — error message goes to stderr only).

**Ping-only failures do not affect exit code** when running `snaky` (all mode). Exit code reflects probe (IP detection) results only. `snaky ping` standalone has its own exit code logic: 0 = all reachable, 1 = some unreachable, 2 = all unreachable.

---

### Table Output (human-readable)

**Probe results:**
```
Split Tunnel Probe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoint         Category   IP              Location  Colo  Latency
────────────────────────────────────────────────────────────────────────
anthropic        ai         203.0.113.42    HK        HKG   45ms
chatgpt          ai         203.0.113.42    HK        HKG   52ms
discord          social     198.51.100.7    US        LAX   180ms
netease          domestic   10.0.0.1        —         —     12ms
bytedance        domestic   10.0.0.2        —         —     8ms
example.com      user       —               —         —     TIMEOUT
────────────────────────────────────────────────────────────────────────
Summary: 5/6 succeeded | Unique IPs: 203.0.113.42 (HK), 198.51.100.7 (US), 10.0.0.1
```

**Connectivity results:**
```
Connectivity Test (median of 12 rounds)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target           Tag            Latency
─────────────────────────────────────────
Bytedance        domestic       8ms
Taobao           domestic       12ms
WeChat           domestic       15ms
GitHub           international  85ms
Cloudflare       international  42ms
YouTube          international  92ms
```

---

## Proxy Support

**Best-effort, not guaranteed.** Node.js built-in `fetch` (undici) does NOT automatically respect `HTTP_PROXY` / `HTTPS_PROXY` environment variables as of Node 20–22. Proxy support depends on the runtime version and may require explicit configuration in future versions.

**v1 policy:**
- Do not add a proxy agent dependency (like `undici-proxy-agent`) in v1
- Document in README that proxy env vars are not honored by default
- If Node adds native proxy support in a future version, it will work automatically
- Users who need proxy can use system-level transparent proxies (e.g., Proxifier, tun2socks)

**Testing:** No proxy-related tests in v1. This is explicitly a non-guaranteed feature.

---

## Configuration

File: `~/.config/snaky/config.json`

```json
{
  "endpoints": [
    { "name": "custom-cdn", "method": "cftrace", "domain": "mycdn.example.com" },
    { "name": "my-proxy-check", "method": "http-header", "url": "https://example.com/check", "headers": ["x-real-ip"] },
    { "name": "openai", "disabled": true },
    { "name": "my-service", "method": "http-header", "url": "https://my.example.com/ip", "headers": ["x-client-ip"], "disabled": true }
  ],
  "pingTargets": [
    { "name": "my-server", "url": "https://myserver.com/health", "tag": "custom" }
  ],
  "timeout": 5000,
  "pingTimeout": 3000,
  "concurrency": 10,
  "retries": 2,
  "pingRounds": 12
}
```

**File lifecycle:**
- Created on first mutating operation: `snaky add`, `snaky disable`, `snaky enable`, `snaky config init`
- **NOT** created by: `snaky`, `snaky probe`, `snaky ping`, `snaky list`, `snaky config path`, `snaky config show`
- `snaky config show` outputs the effective (merged) config to stdout even when no file exists
- Missing file = use built-in defaults with default settings
- Malformed JSON = exit code 3 with clear error on stderr

**Validation (applied on load, reject with exit code 3):**
- `name`: required, must match `/^[a-z0-9][a-z0-9._-]{0,62}$/` (lowercase alphanumeric, dots, hyphens, underscores; 1–63 chars; must start with alphanumeric)
- `domain` (cftrace): required unless `disabled: true`; must be a valid hostname (no scheme, no path, no port)
- `url` (http-header, http-ping): required unless `disabled: true`; must be valid HTTPS URL
- `headers` (http-header): required unless `disabled: true`; non-empty array of valid header names
- `method`: must be one of `cftrace`, `http-header`, `http-ping`; can be omitted if only `disabled: true` (tombstone for built-in)
- Duplicate names in the same config file → error (first occurrence does not win silently)
- `timeout`: must be a positive integer, 100 ≤ timeout ≤ 60000 (ms)
- `pingTimeout`: must be a positive integer, 100 ≤ pingTimeout ≤ 10000 (ms)
- `concurrency`: must be a positive integer, 1 ≤ concurrency ≤ 20
- `retries`: must be a non-negative integer, 0 ≤ retries ≤ 5
- `pingRounds`: must be a positive integer, 1 ≤ pingRounds ≤ 30
- Unknown top-level keys → warning on stderr (forward-compatible, do not error)

---

## macOS App (Snaky.app)

### Tech Stack

| Layer      | Choice                          |
| ---------- | ------------------------------- |
| Language   | Swift 5.9+                      |
| UI         | SwiftUI                         |
| Type       | Menu bar agent (LSUIElement)    |
| Min target | macOS 14 (Sonoma)               |

### Behavior

- Lives in the menu bar (no Dock icon)
- Click icon → popover shows:
  - **Top section:** Connectivity status (ping results as colored dots + median latency)
  - **Middle section:** Unique exit IPs summary (flag + IP, grouped)
  - **Bottom section:** Full probe results table (scrollable)
- "Refresh" button re-invokes CLI
- "Preferences" allows setting CLI binary path and refresh interval
- Invokes `snaky --json` and parses the JSON output
- Optional: periodic auto-refresh (configurable interval, default off)
- Shows per-endpoint status: green/red indicators based on `ok` field

### CLI Invocation & Timeout

- **Total invocation timeout:** 90 seconds. If CLI does not exit within 90s, kill the process and show "CLI timed out" error.
- **During refresh:** "Refresh" button shows a spinner and is non-interactive (no double-invoke)
- **Cancel:** If user clicks Refresh again while a refresh is in-flight, the previous process is killed (SIGTERM → 2s grace → SIGKILL) and a new one starts.
- **Partial output:** If CLI is killed mid-run, any stdout received so far is discarded (incomplete JSON is not parseable). App shows the previous result with a "refresh failed" indicator.

### First-Run & CLI Discovery

Priority order (stop at first success):
1. User-configured path in preferences (persisted in UserDefaults)
2. Well-known install paths (checked in order):
   - `/opt/homebrew/bin/snaky` (Apple Silicon Homebrew)
   - `/usr/local/bin/snaky` (Intel Homebrew / npm global)
   - `~/.local/bin/snaky` (user-local installs)
3. Shell-based lookup: invoke `/bin/zsh -l -c "which snaky"` (login shell to pick up PATH from `.zshrc`/.`zprofile`)

**Why login shell:** GUI apps on macOS do not inherit the user's interactive shell PATH. A login shell (`-l`) sources profile files where nvm/fnm/homebrew typically add their paths. This is the only reliable way to find npm-global binaries.

**Failure mode:** If the login shell hangs or takes >3s, kill it and fall back to hardcoded paths only. Log the timeout to stderr/console for debugging.

**When CLI not found:**
- Show a setup view (not just an error)
- Display installation commands:
  ```
  npm install -g @nocoo/snaky
  # or
  brew install nocoo/tap/snaky (future)
  ```
- "Browse..." button to manually select binary
- "Re-detect" button to retry discovery
- App remains usable for configuration but probe features are disabled

**Version compatibility:**
- App reads `snaky --version` on launch
- If version is below minimum supported, show warning with upgrade command
- App does not hard-fail on version mismatch (graceful degradation)

---

## Code Style

- TypeScript strict mode, no `any`
- ESM only (`"type": "module"`)
- No classes unless necessary — prefer functions and plain objects
- Error handling: throw typed errors, catch at CLI boundary with user-friendly messages
- No comments unless explaining a non-obvious "why"

---

## Testing Strategy

| Scope       | Tool        | Coverage target                              |
| ----------- | ----------- | -------------------------------------------- |
| Unit        | vitest      | Probe parsing (all 3 methods), URL normalization, config merge |
| Snapshot    | vitest      | Table output, JSON output (success/failure/mixed) |
| Integration | vitest      | Full probe against mock HTTP server (all methods) |
| E2E         | vitest      | `snaky` binary invocation + exit codes       |
| Live        | vitest (manual) | `test:live` script — real network validation (non-blocking) |

### Key Test Scenarios

**cftrace parsing:**
- Parse valid `/cdn-cgi/trace` response → extracts ip, loc (uppercase), colo
- Malformed response (missing keys, garbage) → `PARSE_ERROR`
- Empty response body → `PARSE_ERROR`
- Response with only `ip=` (missing loc/colo) → partial success (ip extracted, others null)

**http-header parsing:**
- Response contains expected header with valid IPv4 → extracts IP
- Response contains expected header with valid IPv6 → extracts IP
- Header value contains comma-separated IPs → `PARSE_ERROR`
- Header value contains port (1.2.3.4:8080) → `PARSE_ERROR`
- Header value is empty string → `HEADER_MISSING`
- Response missing all specified headers → `HEADER_MISSING`
- Multiple headers specified, first found wins (second not checked)
- Leading/trailing whitespace trimmed before validation

**http-ping:**
- HTTP 200 response → success with responseTimeMs
- HTTP 204 response → success (generate_204 endpoints)
- HTTP 403 response → success (response received = connectivity confirmed)
- Timeout → round recorded as -1
- Connection refused → round recorded as -1

**Connectivity test (ping):**
- 12 rounds complete → median calculated correctly
- Some rounds timeout (-1) → median of successful rounds only, `ok: true`
- All rounds timeout → `ok: false`, `medianMs: null`, error code `ALL_TIMEOUT`
- Warmup round not counted in results and not in `rounds` array

**URL normalization:**
- Bare domain → valid (cftrace inferred)
- Full HTTPS URL → strips to domain (cftrace inferred)
- URL with path `/cdn-cgi/trace` → strips to domain
- `http://` URL → normalized to domain (probe uses HTTPS)
- `ftp://` → rejected with error
- Trailing slashes stripped
- Positional domain + `--method http-header` → error (conflicting)

**Config & endpoint resolution:**
- No config file → built-in defaults only
- User endpoints merge with defaults
- Name collision → user wins
- Disabled user endpoint (with full config preserved) → suppressed from probe
- `snaky enable` on disabled user endpoint → config restored, endpoint active
- `snaky remove` on user-added → deleted
- `snaky remove` on user override of built-in → override deleted, built-in resurfaces
- `snaky remove` on pure built-in → error message
- `snaky disable` on built-in → tombstone added
- `snaky disable` on user endpoint → `disabled: true` set, config preserved
- `snaky enable` on tombstone → tombstone removed, built-in resurfaces
- Corrupted JSON config file → exit code 3, clear error
- Invalid name (uppercase, special chars, empty) → exit code 3
- Duplicate endpoint names in config → exit code 3
- timeout = 0 or negative → exit code 3
- concurrency = 0 or > 20 → exit code 3
- Invalid method value → exit code 3
- http-header without headers array → exit code 3

**Output snapshots (golden files):**
- Table: all success (mixed methods, location null for http-header)
- Table: mixed success/failure
- Table: all failure
- JSON: mode=all (probe + ping combined)
- JSON: mode=probe (ping is null)
- JSON: mode=ping (probe is null)
- JSON: mixed success/failure with fallback used
- `snaky list` output with mixed sources and methods
- `snaky ping` output: all reachable
- `snaky ping` output: mixed reachable/unreachable

**Timing & concurrency:**
- Concurrent probes respect limit (mock server with delays)
- Timeout fires correctly (mock server that never responds)
- Retry holds concurrency slot during backoff
- Total execution time ≈ max(endpoint latencies) when concurrency >= endpoint count (no retries)
- With retries: verify worst-case timing formula

**Exit codes:**
- All probes success → 0
- Partial probe failure → 1
- All probes failure → 2
- Bad config → 3
- Ping failures don't change exit code in all mode

**Fallback domain (cftrace):**
- Primary domain fails, fallback succeeds → `usedFallback: true`, `resolvedTarget` set
- Both primary and fallback fail → reports failure with last error, `usedFallback: false`
- `responseTimeMs` is from the successful/final request only

**macOS app (Xcode tests):**
- Parse CLI JSON output (mode=all, success fixture)
- Parse CLI JSON output (mode=probe only)
- Parse CLI JSON output (mixed success/failure with fallback)
- Parse connectivity results with rounds array (-1 handling)
- Unique IPs summary rendering (null location displayed as "—")
- CLI not found state transitions
- CLI timeout (90s) handling
- Double-refresh cancel behavior

---

## Boundaries

### Always Do
- Timeout after configurable duration (default 5s for probes, 3s for pings)
- Show clear error per endpoint on failure (don't abort all)
- Separate stdout (data) from stderr (diagnostics) strictly
- Validate config file on load, fail fast with actionable message
- In `--json` mode, always output valid JSON on exit codes 0–2
- Use `{ redirect: "manual" }` in all fetch calls
- Retry failed IP probes before reporting final failure
- Preserve user endpoint config when disabling (don't replace with tombstone)

### Ask First
- Adding dependencies beyond the minimal set listed above
- Changing JSON output schema (breaking for macOS app)
- Adding network features beyond HTTP GET/HEAD (e.g., ICMP ping, TCP connect)
- Adding new error codes to the exhaustive list
- Adding new probe methods beyond the 3 defined

### Never Do
- Send telemetry or analytics
- Cache/store probe results (each run is fresh)
- Require authentication or API keys
- Bundle the CLI inside the macOS app (keep them independent)
- Use Electron or web views for the macOS app
- Follow HTTP redirects during probe (treat as misconfiguration)
- Print anything to stdout except the final structured output
- Perform GeoIP lookups in the CLI (location comes from CF only; null otherwise)

---

## Release & Distribution

| Package   | Channel                                          |
| --------- | ------------------------------------------------ |
| CLI       | npm (`@nocoo/snaky`)                             |
| macOS app | GitHub Releases (DMG) + Homebrew cask (future)   |

---

## Non-Goals (v1)

- Windows/Linux GUI
- Bandwidth testing (download speed)
- Continuous monitoring / daemon mode
- Web dashboard
- Historical data storage
- Custom trace URL paths (only `/cdn-cgi/trace` for cftrace method)
- HTTP/1.1 vs HTTP/2 selection
- ICMP ping (requires root/raw socket — we use HTTP-based latency)
- GeoIP lookup in CLI (rich geo display is app/web concern, not CLI)
- Browser-only detection methods (e.g., Alibaba JSONP/DNS detection — requires DOM/script execution)
- Parsing compound IP header values (comma-separated, port-suffixed)
