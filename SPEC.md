# Snaky — IP Routing Probe & Latency Tester

## Objective

A developer utility for probing outbound IP addresses and measuring latency to various endpoints. Useful for verifying IP routing rules (split tunneling, proxy chains, VPN configurations) by hitting Cloudflare `/cdn-cgi/trace` endpoints on different domains.

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
snaky                       # Probe all active endpoints, show table
snaky probe [name...]       # Probe specific named endpoints only
snaky list                  # List all endpoints (source: built-in / user / disabled)
snaky add <name> <domain>   # Add user endpoint. See "URL Normalization" below.
snaky remove <name>         # Remove a user-added endpoint or user override
snaky disable <name>        # Suppress a built-in endpoint (stores tombstone in config)
snaky enable <name>         # Re-enable a previously disabled built-in endpoint
snaky config path           # Print config file path
snaky config show           # Print current effective config (merged defaults + user)
```

### Global Flags

| Flag            | Description                                              |
| --------------- | -------------------------------------------------------- |
| `--json`        | Output JSON to stdout (table suppressed)                 |
| `--timeout <ms>`| Per-endpoint timeout, overrides config (default: 5000)   |
| `--concurrency <n>` | Max parallel requests (default: 5)                  |
| `--config <path>` | Use custom config file                                |
| `--no-color`    | Disable colored output                                   |
| `--version`     | Print version and exit                                   |
| `--help`        | Print usage and exit                                     |

### stdout / stderr Rules

- **stdout:** Only structured output (table or JSON). Never mix.
- **stderr:** Human-readable logs, warnings, progress indicators.
- In `--json` mode, errors are embedded in the JSON array (see "Error Contract" below), never printed to stdout as free text. stderr may still carry warnings (e.g., "config file not found, using defaults").

### URL Normalization

Endpoints are stored and identified by **domain** (not full trace URL). The CLI constructs the probe URL internally.

**`snaky add` input rules:**
1. Accept bare domain: `openai.com` → stored as `openai.com`
2. Accept full URL: `https://openai.com` or `https://openai.com/cdn-cgi/trace` → normalized to `openai.com`
3. Auto-reject non-HTTP(S) schemes (ftp://, file://, etc.) with error
4. Strip trailing slashes and paths

**Probe URL construction:**
```
https://{stored_domain}/cdn-cgi/trace
```

Always HTTPS. No configuration for custom paths — this tool only supports Cloudflare trace endpoints.

### Proxy Support

**Best-effort, not guaranteed.** Node.js built-in `fetch` (undici) does NOT automatically respect `HTTP_PROXY` / `HTTPS_PROXY` environment variables as of Node 20–22. Proxy support depends on the runtime version and may require explicit configuration in future versions.

**v1 policy:**
- Do not add a proxy agent dependency (like `undici-proxy-agent`) in v1
- Document in README that proxy env vars are not honored by default
- If Node adds native proxy support in a future version, it will work automatically
- Users who need proxy can set `--config` to point to a custom config, or use system-level transparent proxies (e.g., Proxifier, tun2socks)

**Testing:** No proxy-related tests in v1. This is explicitly a non-guaranteed feature.

1. Construct URL: `https://{domain}/cdn-cgi/trace`
2. Send HTTP GET with `{ redirect: "manual" }` — do not follow redirects (3xx = misconfiguration, report as `REDIRECT` error)
3. Record `responseTimeMs`: wall-clock duration from `fetch()` call to response headers received (includes DNS + TCP + TLS + server processing; excludes body read time)
4. Read response body, parse key=value pairs:
   - `ip=` → exit IP address
   - `loc=` → country code
   - `colo=` → Cloudflare datacenter code
5. Return structured result

**Why `responseTimeMs` not "TTFB":** TTFB has ambiguous definitions across tools (some exclude DNS, some include body). We define it precisely as above and name it unambiguously.

### Default Endpoints Strategy

**Built-in defaults** are hardcoded in source (not in config file). They are always present unless explicitly hidden.

**Merge rules:**
- Effective endpoint list = built-in defaults + user-added endpoints − disabled endpoints
- **Name collision:** If a user adds an endpoint with the same name as a built-in, the user entry takes precedence (overrides the built-in domain)
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

### Output Formats

**Table (default, human-readable):**
```
Endpoint        IP              Location  Colo  Latency   Status
────────────────────────────────────────────────────────────────
openai.com      203.0.113.42    HK        HKG   45ms      ok
cloudflare.com  198.51.100.7    US        LAX   180ms     ok
example.com     —               —         —     —         TIMEOUT
```

**JSON (`--json` flag):**

Success entry:
```json
{
  "name": "openai",
  "domain": "openai.com",
  "ok": true,
  "ip": "203.0.113.42",
  "location": "HK",
  "colo": "HKG",
  "responseTimeMs": 45
}
```

Failure entry:
```json
{
  "name": "example",
  "domain": "example.com",
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
- Absent (`undefined`) only when no connection was established (DNS_FAILED, CONNECTION_REFUSED, TLS_ERROR) — there is no meaningful time to report
- macOS app: if `responseTimeMs` is present on a failed entry, display it dimmed; if absent, show "—"
```

**Error codes (exhaustive for v1):**
| Code             | Meaning                                    |
| ---------------- | ------------------------------------------ |
| `TIMEOUT`        | No response within configured timeout      |
| `DNS_FAILED`     | Domain resolution failed                   |
| `CONNECTION_REFUSED` | TCP connection refused                 |
| `TLS_ERROR`      | TLS handshake failure                      |
| `HTTP_ERROR`     | Non-2xx status (includes status in message)|
| `PARSE_ERROR`    | Response body not valid trace format       |
| `REDIRECT`       | Server responded with 3xx redirect         |
| `UNKNOWN`        | Unexpected error                           |

**Top-level JSON structure:**
```json
{
  "results": [ ...entries... ],
  "summary": {
    "total": 5,
    "succeeded": 3,
    "failed": 2
  }
}
```

### Exit Codes

| Code | Meaning                        |
| ---- | ------------------------------ |
| 0    | All probes succeeded           |
| 1    | Some probes failed (partial)   |
| 2    | All probes failed              |
| 3    | Fatal error (bad config, etc.) |

**JSON completeness guarantee:** When `--json` is active, exit codes 0, 1, and 2 ALL produce valid, complete JSON on stdout. The macOS app can safely parse stdout regardless of exit code (0–2). Only exit code 3 may produce no stdout (fatal error before probing starts — error message goes to stderr only).

macOS app should treat exit code 1 as "results available but incomplete" and display them with error indicators per endpoint.

### Configuration

File: `~/.config/snaky/config.json`

```json
{
  "endpoints": [
    { "name": "custom-cdn", "domain": "mycdn.example.com" },
    { "name": "openai", "disabled": true }
  ],
  "timeout": 5000,
  "concurrency": 5
}
```

**Rules:**
- File created on first `snaky add`, `snaky disable`, or `snaky config show` invocation (not on bare `snaky` run)
- Missing file = use built-in defaults with default settings
- Malformed JSON = exit code 3 with clear error on stderr
- `disabled: true` suppresses any endpoint with that name

**Validation (applied on load, reject with exit code 3):**
- `name`: required, must match `/^[a-z0-9][a-z0-9._-]{0,62}$/` (lowercase alphanumeric, dots, hyphens, underscores; 1–63 chars; must start with alphanumeric)
- `domain`: required unless `disabled: true`; must be a valid hostname (no scheme, no path, no port)
- Duplicate names in the same config file → error (first occurrence does not win silently)
- `timeout`: must be a positive integer, 100 ≤ timeout ≤ 60000 (ms). Values outside range → error
- `concurrency`: must be a positive integer, 1 ≤ concurrency ≤ 20. Values outside range → error
- Unknown top-level keys → warning on stderr (forward-compatible, do not error)

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
- Click icon → popover shows latest probe results in a compact table
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

## Code Style

- TypeScript strict mode, no `any`
- ESM only (`"type": "module"`)
- No classes unless necessary — prefer functions and plain objects
- Error handling: throw typed errors, catch at CLI boundary with user-friendly messages
- No comments unless explaining a non-obvious "why"

## Testing Strategy

| Scope       | Tool        | Coverage target                              |
| ----------- | ----------- | -------------------------------------------- |
| Unit        | vitest      | Probe parsing, URL normalization, config merge |
| Snapshot    | vitest      | Table output, JSON output (success/failure/mixed) |
| Integration | vitest      | Full probe against mock HTTP server          |
| E2E         | vitest      | `snaky` binary invocation + exit codes       |

### Key Test Scenarios

**Probe parsing:**
- Parse valid `/cdn-cgi/trace` response → extracts all fields
- Malformed response (missing keys, garbage) → `PARSE_ERROR`
- Empty response body → `PARSE_ERROR`

**URL normalization:**
- Bare domain → valid
- Full HTTPS URL → strips to domain
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

**Output snapshots (golden files):**
- Table: all success
- Table: mixed success/failure
- Table: all failure
- JSON: all success
- JSON: mixed success/failure
- JSON: all failure
- `snaky list` output with mixed sources

**Timing & concurrency:**
- Concurrent probes respect limit (mock server with delays)
- Timeout fires correctly (mock server that never responds)
- Total execution time ≈ max(endpoint latencies) when concurrency >= endpoint count

**Exit codes:**
- All success → 0
- Partial failure → 1
- All failure → 2
- Bad config → 3

**macOS app (Xcode tests):**
- Parse CLI JSON output (success fixture)
- Parse CLI JSON output (mixed success/failure fixture)
- Parse CLI JSON output (malformed → graceful error)
- CLI not found state transitions

## Boundaries

### Always Do
- Timeout after configurable duration (default 5s)
- Show clear error per endpoint on failure (don't abort all)
- Separate stdout (data) from stderr (diagnostics) strictly
- Validate config file on load, fail fast with actionable message
- In `--json` mode, always output valid JSON on exit codes 0–2
- Use `{ redirect: "manual" }` in fetch calls

### Ask First
- Adding dependencies beyond the minimal set listed above
- Changing JSON output schema (breaking for macOS app)
- Adding network features beyond HTTP GET (e.g., ICMP ping, TCP connect)
- Adding new error codes to the exhaustive list

### Never Do
- Send telemetry or analytics
- Cache/store probe results (each run is fresh)
- Require authentication or API keys
- Bundle the CLI inside the macOS app (keep them independent)
- Use Electron or web views for the macOS app
- Follow HTTP redirects during probe (treat as misconfiguration)
- Print anything to stdout except the final structured output

## Release & Distribution

| Package   | Channel                                          |
| --------- | ------------------------------------------------ |
| CLI       | npm (`@nocoo/snaky`)                             |
| macOS app | GitHub Releases (DMG) + Homebrew cask (future)   |

## Non-Goals (v1)

- Windows/Linux GUI
- Bandwidth testing
- Continuous monitoring / daemon mode
- Web dashboard
- Historical data storage
- Custom trace URL paths (only `/cdn-cgi/trace`)
- HTTP/1.1 vs HTTP/2 selection
