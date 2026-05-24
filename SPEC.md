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
snaky add <name> <target>   # Add user endpoint. See "Endpoint Definition" below.
snaky remove <name>         # Remove a user-added endpoint or user override
snaky disable <name>        # Suppress a built-in endpoint (stores tombstone in config)
snaky enable <name>         # Re-enable a previously disabled built-in endpoint
snaky config path           # Print config file path
snaky config show           # Print current effective config (merged defaults + user)
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
- `loc=` → country code (lowercase ISO 3166-1 alpha-2)
- `colo=` → Cloudflare datacenter code (IATA)

**Fallback domain:** Some endpoints define a `fallbackDomain`. If the primary domain fails, retry with the fallback before reporting error.

### Method 2: `http-header` (Response Header Inspection)

For CDN providers that expose the client IP in a response header (not Cloudflare-based).

**Request:** `HEAD {url}` with `{ redirect: "manual" }`  
**Response:** Read specific header(s) for the client IP  
**Configuration per endpoint:**
- `url`: full URL to request
- `headers`: ordered list of header names to check (first non-empty wins)

**Examples:**
- Netease CDN: `HEAD https://necaptcha.nosdn.127.net/...` → header `cdn-user-ip`
- Bytedance CDN: `HEAD https://perfops.byte-test.com/...` → headers `x-request-ip`, `x-response-cinfo`

**Extracts:** IP address only (no country code or datacenter from this method — requires geo lookup).

### Method 3: `http-ping` (Connectivity & Latency Only)

For connectivity tests where we only care about reachability and latency, not the exit IP.

**Request:** `GET {url}` or `HEAD {url}` (configurable per endpoint)  
**Success criteria:** Any HTTP response received (including non-2xx status codes like 204, 403)  
**Extracts:** `responseTimeMs` only — no IP, no geo.

**Used for:** `snaky ping` targets (GitHub generate_204, YouTube generate_204, Taobao favicon, etc.)

---

## Probe Logic (Unified)

For all methods:
1. Record start time
2. Execute HTTP request per method spec, with `{ redirect: "manual" }`
3. Record `responseTimeMs`: wall-clock duration from `fetch()` call to response headers received (includes DNS + TCP + TLS + server processing; excludes body read time)
4. For `cftrace`: read body and parse key=value pairs
5. For `http-header`: read specified response header(s)
6. For `http-ping`: response received = success (no body/header parsing)
7. Return structured result

**Why `responseTimeMs` not "TTFB":** TTFB has ambiguous definitions across tools (some exclude DNS, some include body). We define it precisely as above and name it unambiguously.

**Retry policy:** Failed probes are retried up to 2 times with exponential backoff (2s, 4s delay). Retries are per-endpoint and do not block other endpoints.

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
- All targets probed concurrently within each round
- Per-probe timeout: 3000ms (shorter than IP probe timeout)
- Results include per-round history for sparkline/dot visualization in macOS app

---

## Endpoint Definition (for user-added endpoints)

User-added endpoints (`snaky add`) support all 3 methods. The `<target>` argument determines the method:

```
snaky add <name> <domain>                    # Inferred as cftrace (domain only)
snaky add <name> --method http-header \
  --url <url> --header <header-name>         # Explicit http-header method
snaky add <name> --method http-ping \
  --url <url>                                # Explicit http-ping method
```

**Shorthand (most common case):** `snaky add mysite example.com` → cftrace on `example.com`

### URL / Domain Normalization (for cftrace method)

- Accept bare domain: `openai.com` → stored as `openai.com`
- Accept full URL: `https://openai.com` or `https://openai.com/cdn-cgi/trace` → normalized to `openai.com`
- Auto-reject non-HTTP(S) schemes (ftp://, file://, etc.) with error
- Strip trailing slashes and paths
- Probe URL construction: `https://{stored_domain}/cdn-cgi/trace`

### Validation for http-header / http-ping methods

- `url`: must be a valid HTTPS URL (HTTP rejected with warning — insecure)
- `header`: required for `http-header`, must be a valid HTTP header name

---

## Default Endpoints Strategy

**Built-in defaults** are hardcoded in source (not in config file). They are always present unless explicitly hidden.

**Merge rules:**
- Effective endpoint list = built-in defaults + user-added endpoints − disabled endpoints
- **Name collision:** If a user adds an endpoint with the same name as a built-in, the user entry takes precedence (overrides the built-in)
- **`snaky list`** shows source column: `built-in` | `user` | `disabled`

**`snaky remove` behavior:**
- Target is a user-added endpoint (no built-in with same name) → delete it from config
- Target is a user override of a built-in (same name exists in built-in) → delete the override, built-in resurfaces
- Target is a pure built-in (no user entry) → error: "Cannot remove built-in endpoint. Use `snaky disable <name>` to suppress it."
- Target does not exist → error: "Endpoint '<name>' not found"

**`snaky disable <name>` / `snaky enable <name>`:**
- `disable` stores `{ "name": "<name>", "disabled": true }` in config — suppresses any built-in or user entry with that name
- `enable` removes the disabled tombstone — if a built-in or user entry exists with that name, it becomes active again
- `disable` on an already-disabled endpoint → no-op (idempotent)
- `enable` on a non-disabled endpoint → no-op (idempotent)

---

## Output Formats

### Probe Results (IP Detection)

**Table (default, human-readable):**
```
Split Tunnel Probe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Endpoint         Category   IP              Location  Colo  Latency
────────────────────────────────────────────────────────────────────────
anthropic        ai         203.0.113.42    HK        HKG   45ms
chatgpt          ai         203.0.113.42    HK        HKG   52ms
discord          social     198.51.100.7    US        LAX   180ms
netease          domestic   10.0.0.1        CN        —     12ms
bytedance        domestic   10.0.0.2        CN        —     8ms
example.com      user       —               —         —     TIMEOUT
────────────────────────────────────────────────────────────────────────
Summary: 5/6 succeeded | Unique IPs: 203.0.113.42 (HK), 198.51.100.7 (US), 10.0.0.1 (CN)
```

### Connectivity Results (Ping)

**Table:**
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

### JSON (`--json` flag)

**Top-level structure:**
```json
{
  "probe": {
    "results": [ ...probe entries... ],
    "summary": {
      "total": 28,
      "succeeded": 25,
      "failed": 3
    },
    "uniqueIps": [
      { "ip": "203.0.113.42", "location": "HK", "count": 20 },
      { "ip": "198.51.100.7", "location": "US", "count": 3 },
      { "ip": "10.0.0.1", "location": "CN", "count": 2 }
    ]
  },
  "ping": {
    "results": [ ...ping entries... ]
  }
}
```

**Probe success entry:**
```json
{
  "name": "openai",
  "category": "ai",
  "method": "cftrace",
  "ok": true,
  "ip": "203.0.113.42",
  "location": "HK",
  "colo": "HKG",
  "responseTimeMs": 45
}
```

**Probe success entry (http-header method — no colo):**
```json
{
  "name": "netease",
  "category": "domestic",
  "method": "http-header",
  "ok": true,
  "ip": "10.0.0.1",
  "location": "CN",
  "colo": null,
  "responseTimeMs": 12
}
```

**Probe failure entry:**
```json
{
  "name": "example",
  "category": "user",
  "method": "cftrace",
  "ok": false,
  "responseTimeMs": 5003,
  "error": {
    "code": "TIMEOUT",
    "message": "Request timed out after 5000ms"
  }
}
```

**`responseTimeMs` in failure entries:**
- Always present when measurable (TIMEOUT, HTTP_ERROR, PARSE_ERROR, REDIRECT) — shows elapsed time before failure
- Absent (`undefined`) only when no connection was established (DNS_FAILED, CONNECTION_REFUSED, TLS_ERROR)

**Ping entry:**
```json
{
  "name": "ping-github",
  "tag": "international",
  "ok": true,
  "medianMs": 85,
  "rounds": [92, 88, 85, 84, 86, 85, 83, 87, 85, 84, 86, 85]
}
```

**Ping failure entry:**
```json
{
  "name": "ping-youtube",
  "tag": "international",
  "ok": false,
  "medianMs": null,
  "rounds": [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  "error": { "code": "TIMEOUT", "message": "All 12 rounds timed out" }
}
```

(`-1` in rounds array = that round timed out)

**Error codes (exhaustive for v1):**

| Code                 | Meaning                                    |
| -------------------- | ------------------------------------------ |
| `TIMEOUT`            | No response within configured timeout      |
| `DNS_FAILED`         | Domain resolution failed                   |
| `CONNECTION_REFUSED` | TCP connection refused                     |
| `TLS_ERROR`          | TLS handshake failure                      |
| `HTTP_ERROR`         | Non-2xx status (includes status in message)|
| `PARSE_ERROR`        | Response body not valid trace format       |
| `REDIRECT`           | Server responded with 3xx redirect         |
| `HEADER_MISSING`     | Expected IP header not present in response |
| `UNKNOWN`            | Unexpected error                           |

### Exit Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 0    | All probes succeeded           |
| 1    | Some probes failed (partial)   |
| 2    | All probes failed              |
| 3    | Fatal error (bad config, etc.) |

**JSON completeness guarantee:** When `--json` is active, exit codes 0, 1, and 2 ALL produce valid, complete JSON on stdout. The macOS app can safely parse stdout regardless of exit code (0–2). Only exit code 3 may produce no stdout (fatal error before probing starts — error message goes to stderr only).

**Ping-only failures do not affect exit code.** Exit code reflects probe (IP detection) results only. `snaky ping` has its own exit code logic: 0 = all reachable, 1 = some unreachable, 2 = all unreachable.

macOS app should treat exit code 1 as "results available but incomplete" and display them with error indicators per endpoint.

---

## Proxy Support

**Best-effort, not guaranteed.** Node.js built-in `fetch` (undici) does NOT automatically respect `HTTP_PROXY` / `HTTPS_PROXY` environment variables as of Node 20–22. Proxy support depends on the runtime version and may require explicit configuration in future versions.

**v1 policy:**
- Do not add a proxy agent dependency (like `undici-proxy-agent`) in v1
- Document in README that proxy env vars are not honored by default
- If Node adds native proxy support in a future version, it will work automatically
- Users who need proxy can set `--config` to point to a custom config, or use system-level transparent proxies (e.g., Proxifier, tun2socks)

**Testing:** No proxy-related tests in v1. This is explicitly a non-guaranteed feature.

---

## Configuration

File: `~/.config/snaky/config.json`

```json
{
  "endpoints": [
    { "name": "custom-cdn", "method": "cftrace", "domain": "mycdn.example.com" },
    { "name": "my-proxy-check", "method": "http-header", "url": "https://example.com/check", "headers": ["x-real-ip"] },
    { "name": "openai", "disabled": true }
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

**Rules:**
- File created on first `snaky add`, `snaky disable`, or `snaky config show` invocation (not on bare `snaky` run)
- Missing file = use built-in defaults with default settings
- Malformed JSON = exit code 3 with clear error on stderr
- `disabled: true` suppresses any endpoint with that name

**Validation (applied on load, reject with exit code 3):**
- `name`: required, must match `/^[a-z0-9][a-z0-9._-]{0,62}$/` (lowercase alphanumeric, dots, hyphens, underscores; 1–63 chars; must start with alphanumeric)
- `domain` (cftrace): required; must be a valid hostname (no scheme, no path, no port)
- `url` (http-header, http-ping): required; must be valid HTTPS URL
- `headers` (http-header): non-empty array of valid header names
- `method`: must be one of `cftrace`, `http-header`, `http-ping`
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

### Key Test Scenarios

**cftrace parsing:**
- Parse valid `/cdn-cgi/trace` response → extracts ip, loc, colo
- Malformed response (missing keys, garbage) → `PARSE_ERROR`
- Empty response body → `PARSE_ERROR`
- Response with only `ip=` (missing loc/colo) → partial success (ip extracted, others null)

**http-header parsing:**
- Response contains expected header → extracts IP
- Response missing all specified headers → `HEADER_MISSING`
- Multiple headers specified, first found wins
- Header value is not a valid IP → `PARSE_ERROR`

**http-ping:**
- Any HTTP response (200, 204, 403, etc.) → success with responseTimeMs
- Timeout → failure
- Connection refused → failure

**Connectivity test (ping):**
- 12 rounds complete → median calculated correctly
- Some rounds timeout (-1) → median of successful rounds only
- All rounds timeout → failure with null medianMs
- Warmup round not counted in results

**URL normalization:**
- Bare domain → valid (cftrace inferred)
- Full HTTPS URL → strips to domain (cftrace inferred)
- URL with path `/cdn-cgi/trace` → strips to domain
- `http://` URL → normalized to domain (probe uses HTTPS)
- `ftp://` → rejected with error
- Trailing slashes stripped

**Config & endpoint resolution:**
- No config file → built-in defaults only
- User endpoints merge with defaults
- Name collision → user wins
- Disabled endpoint → suppressed from probe
- `snaky remove` on user-added → deleted
- `snaky remove` on user override of built-in → override deleted, built-in resurfaces
- `snaky remove` on pure built-in → error message
- `snaky disable` on built-in → suppressed
- `snaky enable` on disabled → reactivated
- Corrupted JSON config file → exit code 3, clear error
- Invalid name (uppercase, special chars, empty) → exit code 3
- Duplicate endpoint names in config → exit code 3
- timeout = 0 or negative → exit code 3
- concurrency = 0 or > 20 → exit code 3
- Invalid method value → exit code 3
- http-header without headers array → exit code 3

**Output snapshots (golden files):**
- Table: all success (mixed methods)
- Table: mixed success/failure
- Table: all failure
- JSON: all success (mixed methods)
- JSON: mixed success/failure
- JSON: all failure
- `snaky list` output with mixed sources and methods
- `snaky ping` output: all reachable
- `snaky ping` output: mixed reachable/unreachable
- JSON: full run (probe + ping combined)

**Timing & concurrency:**
- Concurrent probes respect limit (mock server with delays)
- Timeout fires correctly (mock server that never responds)
- Total execution time ≈ max(endpoint latencies) when concurrency >= endpoint count
- Retry logic: failed endpoint retried up to N times with backoff

**Exit codes:**
- All success → 0
- Partial failure → 1
- All failure → 2
- Bad config → 3

**Fallback domain (cftrace):**
- Primary domain fails, fallback succeeds → reports success
- Both primary and fallback fail → reports failure with last error

**macOS app (Xcode tests):**
- Parse CLI JSON output (success fixture, all methods)
- Parse CLI JSON output (mixed success/failure fixture)
- Parse CLI JSON output (malformed → graceful error)
- Parse connectivity results with rounds array
- Unique IPs summary rendering
- CLI not found state transitions

---

## Boundaries

### Always Do
- Timeout after configurable duration (default 5s for probes, 3s for pings)
- Show clear error per endpoint on failure (don't abort all)
- Separate stdout (data) from stderr (diagnostics) strictly
- Validate config file on load, fail fast with actionable message
- In `--json` mode, always output valid JSON on exit codes 0–2
- Use `{ redirect: "manual" }` in all fetch calls
- Retry failed probes before reporting final failure

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
- GeoIP lookup (CLI detects exit IP + CF-provided location; rich geo display is app/web concern)
- Browser-only detection methods (e.g., Alibaba JSONP/DNS detection — requires DOM/script execution)
