# DNS Leak Detection

**Status**: Draft v2
**Date**: 2026-05-26

## Objective

Add DNS leak detection to Snaky. Detect which DNS resolver exit IPs are actually handling name resolution, exposing leaks where DNS queries bypass VPN/proxy tunnels.

**Target users**: VPN/proxy users who want to verify their DNS traffic is properly tunneled.

**Backend dependency**: Echo project's deployed infrastructure — `dns-probe` (VPS authoritative DNS) + `collector` Worker (Cloudflare KV). Infrastructure is live at `echo-collector.worker.hexly.ai`.

**Web reference**: Production web version at `ip.net.coffee/dns/` — this spec aligns CLI behavior with it.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  snaky dns (CLI)                                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Generate random token (12-char hex)                         │
│  2. dns.lookup({token}-{1..N}.d.echo.nocoo.cloud) × N rounds   │
│     (uses getaddrinfo → system DNS resolver path)              │
│  3. Poll collector API for results (up to 3 attempts)           │
│  4. Enrich resolver IPs with geo/ISP via echo API               │
│  5. Compare resolver geo with user exit IP geo → verdict        │
│  6. Output structured result (JSON or table)                    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  macOS app — DnsLeakView (Tab: "DNS Leak")                      │
├─────────────────────────────────────────────────────────────────┤
│  Calls: snaky dns --json                                        │
│  Shows: resolver IP list with geo/ISP, leak verdict             │
│  Trigger: manual button press (independent of split/connect)    │
└─────────────────────────────────────────────────────────────────┘
```

### Detection Flow (Backend — already deployed)

```
Client dns.lookup()  ← uses getaddrinfo (system resolver path)
  → macOS mDNSResponder / system resolver
  → Configured DNS server (or VPN-scoped DNS)
  → Recursive query hits NS delegation for d.echo.nocoo.cloud
  → VPS dns-probe (jp2:53/UDP) receives query, extracts resolver exit IP
  → dns-probe POSTs to collector Worker
  → Worker stores IP in KV (key: dns:{token}, TTL: 5min)
  → Client polls GET /result/{token} to read all resolver exit IPs
```

### Why `dns.lookup()` not `dns.resolve4()`

| | `dns.lookup()` | `dns.resolve4()` |
|--|--|--|
| Backend | getaddrinfo (OS) | c-ares (libuv) |
| Respects VPN scoped DNS | Yes | No |
| Respects macOS mDNSResponder | Yes | No |
| Enterprise DNS config | Yes | Partial |
| What browsers use | Equivalent | Different path |

`dns.lookup()` goes through the same system resolution path as browsers and other apps. This is what we want to test — "where does my system's DNS traffic actually go?"

---

## CLI Implementation

### Subcommand: `snaky dns`

```bash
snaky dns [options]
```

**Options**:
| Flag | Default | Range | Description |
|------|---------|-------|-------------|
| `--rounds <n>` | 5 | 1–20 | Number of DNS queries to trigger |
| `--extended` | false | — | Use 8 rounds (shortcut for `--rounds 8`) |
| `--json` | false | — | Output JSON to stdout |
| `--no-color` | false | — | Disable colored output |

**Priority**: CLI flag > config `dnsLeak` section > hardcoded default.

**Behavior**:

1. Generate a 12-char random token: `crypto.randomBytes(6).toString('hex')`
2. Determine user's exit IP and country code:
   - Fetch `1.1.1.1/cdn-cgi/trace` → parse `ip=` and `loc=` fields (loc is ISO country code)
   - `userCountryCode` comes directly from cftrace `loc` field
   - `userCountry` (full name) is populated only if echo API key is available (enrich user IP); otherwise `null`
   - Verdict comparison uses `userCountryCode` (always available from cftrace), not `userCountry`
3. Trigger `rounds` DNS lookups via `dns.promises.lookup()` (getaddrinfo):
   - Domains: `{token}-1.d.echo.nocoo.cloud` through `{token}-{rounds}.d.echo.nocoo.cloud`
   - Each lookup has a 5s logical timeout via `Promise.race` (see below)
   - Late-arriving getaddrinfo results are simply ignored (cannot cancel OS-level resolution)
   - Ignore resolution results (they return `10.255.255.1` or may timeout — irrelevant)
   - 600ms delay between rounds (match web behavior, avoid overwhelming resolver cache)
4. Poll collector API for results (up to 3 attempts, 2s interval):
   - `GET https://echo-collector.worker.hexly.ai/result/{token}`
   - Stop polling once `dns_servers` array is non-empty
5. Enrich each resolver IP with geo/ISP via echo API (requires `echoApiKey` in secrets)
6. Determine verdict:
   - If `expectedResolvers` is configured → use CIDR allowlist matching
   - Else if geo enrichment succeeded → compare resolver country with user exit IP country
   - Else (no expectedResolvers AND no API key) → `verdict: "inconclusive"`
7. Output result

**DNS Timeout implementation**:
```typescript
// dns.lookup() uses OS getaddrinfo — no way to cancel the underlying syscall.
// We use Promise.race for a logical timeout; the late result is simply ignored.
async function lookupWithTimeout(hostname: string, timeoutMs: number): Promise<void> {
  await Promise.race([
    dns.promises.lookup(hostname).then(() => {}, () => {}),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  // Both branches always resolve (never reject):
  //   - lookup: .then(noop, noop) swallows both success and DNS errors
  //   - timeout: resolves after timeoutMs
  // We don't need the result, only the side-effect of triggering system DNS.
}
```

### Verdict Logic

The leak heuristic has three tiers (first match wins):

**Tier 1: `expectedResolvers` configured** (CIDR allowlist):
```
if (all resolver IPs match expectedResolvers CIDRs) → "no_leak"
if (any resolver IP outside all CIDRs)              → "leak"
if (no resolvers found)                             → "inconclusive"
```

**Tier 2: geo comparison** (requires echoApiKey for resolver enrichment + cftrace for user country code):
```
if (no resolvers found)                                    → "inconclusive"
if (user exit IP unavailable OR userCountryCode missing)   → "inconclusive"
if (resolver geo enrichment failed)                        → "inconclusive"
if (any resolver countryCode ≠ userCountryCode)            → "leak"
else                                                       → "no_leak"
```

**Tier 3: no expectedResolvers AND no API key**:
```
always → "inconclusive" (resolvers listed but cannot determine leak)
```

Per-server `leaked` flag: set to `true` when that specific server triggered the leak verdict (country mismatch or CIDR mismatch).

**Important**: The resolver exit IP seen by dns-probe is NOT necessarily the same as the user's configured DNS server IP. It's the egress IP of the recursive resolver. E.g., user sets `1.1.1.1`, but Cloudflare's resolver might query our authoritative from `172.64.x.x`. This is why `expectedResolvers` supports CIDRs, not just exact IPs.

### Exit Codes

| Code | Meaning | JSON guaranteed? |
|------|---------|-----------------|
| 0 | Detection complete, no leak | Yes |
| 1 | Detection complete, leak detected | Yes |
| 2 | Detection inconclusive (empty result, network error) | Yes |
| 3 | Argument/config error | No (stderr only) |

**Exit 0, 1, 2 always produce valid JSON on stdout** (when `--json` is used). This is critical for macOS bridge to decode reliably.

### JSON Output Schema

```typescript
type DnsLeakOutput = {
  token: string;
  rounds: number;
  userIp: string | null;
  userCountry: string | null;
  userCountryCode: string | null;
  dnsServers: DnsServer[];
  count: number;
  verdict: "no_leak" | "leak" | "inconclusive";
};

type DnsServer = {
  ip: string;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  isp: string | null;
  asn: number | null;
  asOrg: string | null;
  leaked: boolean; // per-server leak flag
};
```

**Example output (no leak)**:
```json
{
  "token": "a1b2c3d4e5f6",
  "rounds": 5,
  "userIp": "104.28.12.34",
  "userCountry": "United States",
  "userCountryCode": "US",
  "dnsServers": [
    {
      "ip": "172.64.36.1",
      "country": "United States",
      "countryCode": "US",
      "city": null,
      "isp": "Cloudflare",
      "asn": 13335,
      "asOrg": "Cloudflare, Inc.",
      "leaked": false
    }
  ],
  "count": 1,
  "verdict": "no_leak"
}
```

**Example output (leak detected)**:
```json
{
  "token": "f7e8d9c0b1a2",
  "rounds": 5,
  "userIp": "104.28.12.34",
  "userCountry": "United States",
  "userCountryCode": "US",
  "dnsServers": [
    {
      "ip": "114.114.114.114",
      "country": "China",
      "countryCode": "CN",
      "city": "Nanjing",
      "isp": "China Unicom",
      "asn": 4837,
      "asOrg": "CHINA UNICOM China169 Backbone",
      "leaked": true
    }
  ],
  "count": 1,
  "verdict": "leak"
}
```

**Example output (inconclusive)**:
```json
{
  "token": "deadbeef1234",
  "rounds": 5,
  "userIp": null,
  "userCountry": null,
  "userCountryCode": null,
  "dnsServers": [],
  "count": 0,
  "verdict": "inconclusive"
}
```

### Table Output (non-JSON mode)

**No leak:**
```
DNS Leak Test (5 rounds)
─────────────────────────────────────────────────
Your IP: 104.28.12.34 (US)

#  Resolver IP       ISP              Location    Status
1  172.64.36.1       Cloudflare       US          ✓ OK

✓ No DNS leak detected (1 resolver found)
```

**Leak detected:**
```
DNS Leak Test (5 rounds)
─────────────────────────────────────────────────
Your IP: 104.28.12.34 (US)

#  Resolver IP       ISP              Location    Status
1  172.64.36.1       Cloudflare       US          ✓ OK
2  114.114.114.114   China Unicom     CN          ⚠ LEAK

⚠ DNS leak detected! 1 of 2 resolvers may be leaking
```

**Inconclusive:**
```
DNS Leak Test (5 rounds)
─────────────────────────────────────────────────

No DNS resolvers detected. Possible causes:
  - DNS queries are encrypted (DoH/DoT) and bypass recursive resolution
  - Network connectivity issue
  - DNS probe service temporarily unavailable

Unable to determine leak status.
```

### Config Schema Extension

Add optional `dnsLeak` section to snaky config:

```json
{
  "dnsLeak": {
    "rounds": 5,
    "expectedResolvers": ["1.1.1.0/24", "172.64.0.0/16"]
  }
}
```

- `expectedResolvers`: Array of IPs or CIDRs. If set, verdict uses allowlist matching instead of geo-comparison. Supports exact IP and CIDR notation to handle Anycast/load-balanced DNS resolvers.
- `rounds`: Override default round count.

**Config changes required**:
- `config/types.ts` — Add `DnsLeakConfig` type to `EffectiveConfig`
- `config/schema.ts` — Add `dnsLeak` to `KNOWN_KEYS`, add validation
- `config/loader.ts` — Merge `dnsLeak` defaults into effective config
- `config/schema.test.ts` — Validate dnsLeak field parsing
- `config/loader.test.ts` — Test default merging

---

## CLI Source Structure

New files under `packages/cli/src/`:

```
dns-leak/
├── detect.ts        # Core detection logic (token gen, lookup, poll, verdict)
├── detect.test.ts   # Unit tests with mocked dns.lookup + fetch
├── types.ts         # DnsLeakOutput, DnsServer types
├── output.ts        # Table formatter for dns-leak results
├── output.test.ts   # Table output tests for all three verdict states
└── cidr.ts          # CIDR matching utility (for expectedResolvers)
```

Changes to existing files:
- `cli/args.ts` — `DnsCommand` type, parse `dns` subcommand with `--rounds`, `--extended`
- `cli/args.test.ts` — Tests for dns arg parsing
- `cli.ts` — `handleDns()` handler
- `config/types.ts` — Add `DnsLeakConfig` interface
- `config/schema.ts` — Add `dnsLeak` to known keys + validation
- `config/loader.ts` — Merge dnsLeak defaults
- `config/schema.test.ts` — dnsLeak validation tests
- `config/loader.test.ts` — dnsLeak default merging tests

---

## macOS App Implementation

### Model

Add to `Models.swift`:

```swift
public struct DnsLeakOutput: Codable, Sendable, Equatable {
    public let token: String
    public let rounds: Int
    public let userIp: String?
    public let userCountry: String?
    public let userCountryCode: String?
    public let dnsServers: [DnsServer]
    public let count: Int
    public let verdict: DnsLeakVerdict
}

public struct DnsServer: Codable, Sendable, Equatable {
    public let ip: String
    public let country: String?
    public let countryCode: String?
    public let city: String?
    public let isp: String?
    public let asn: Int?
    public let asOrg: String?
    public let leaked: Bool
}

public enum DnsLeakVerdict: String, Codable, Sendable {
    case noLeak = "no_leak"
    case leak
    case inconclusive
}
```

### CLIBridge Extension

Add method to `CLIBridge` following existing error handling pattern:

```swift
public func invokeDnsLeak(extended: Bool = false) async throws -> DnsLeakOutput {
    guard let path = await discovery.discover() else {
        throw CLIError.notFound
    }
    var args = ["dns", "--json"]
    if extended { args.insert("--extended", at: 1) }
    let output = try await executor.run(
        executablePath: path,
        arguments: args,
        timeout: .seconds(30)
    )
    // Exit 0, 1, 2 all produce valid JSON — decode them
    // Exit 3 = argument error — no valid JSON
    switch output.exitCode {
    case 0, 1, 2:
        return try decodeDnsLeakOutput(output.stdout)
    case 3:
        let stderr = String(data: output.stderr, encoding: .utf8) ?? "Unknown error"
        throw CLIError.fatal(stderr.trimmingCharacters(in: .whitespacesAndNewlines))
    default:
        throw CLIError.crashed(output.exitCode)
    }
}

private func decodeDnsLeakOutput(_ data: Data) throws -> DnsLeakOutput {
    do {
        return try JSONDecoder().decode(DnsLeakOutput.self, from: data)
    } catch {
        throw CLIError.decodingFailed(error.localizedDescription)
    }
}
```

### DnsLeakView

Replace placeholder with functional view:

```
┌─────────────────────────────────────────┐
│  DNS Leak Test                          │
│                                         │
│  [Run Test]  [Extended Test]            │
│                                         │
│  ── Results ──                          │
│  Your IP: 🇺🇸 104.28.12.34 (US)        │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │ ✓ 172.64.36.1                     │  │
│  │   Cloudflare · US                 │  │
│  ├───────────────────────────────────┤  │
│  │ ⚠ 114.114.114.114                 │  │
│  │   China Unicom · CN  [LEAK]       │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ⚠ DNS leak detected!                  │
│  1 of 2 resolvers may be leaking       │
└─────────────────────────────────────────┘
```

**States**:
- Idle: "Run Test" / "Extended Test" buttons, description text
- Loading: Progress indicator with phase text ("Resolving DNS...", "Polling results...", "Enriching geo data...")
- Success (no_leak): Green verdict badge, resolver list with ✓ marks
- Success (leak): Red verdict badge, resolver list with ⚠ marks on leaked IPs
- Success (inconclusive): Gray verdict badge, explanation text
- Error: Error message with retry button

### ViewModel

Create dedicated `DnsLeakViewModel` (keeps DnsLeak independent from split/connect):

```swift
@MainActor
public final class DnsLeakViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: DnsLeakState = .idle

    public enum DnsLeakState: Equatable {
        case idle
        case loading
        case success(DnsLeakOutput)
        case error(CLIError)
    }

    private var currentTask: Task<Void, Never>?

    public init(bridge: CLIBridge) { self.bridge = bridge }

    public func runTest(extended: Bool = false) {
        currentTask?.cancel()
        state = .loading
        currentTask = Task {
            do {
                let result = try await bridge.invokeDnsLeak(extended: extended)
                guard !Task.isCancelled else { return }
                state = .success(result)
            } catch let error as CLIError {
                guard !Task.isCancelled else { return }
                state = .error(error)
            } catch {
                guard !Task.isCancelled else { return }
                state = .error(.timeout)
            }
        }
    }
}
```

---

## Testing Strategy

### CLI Unit Tests

**`dns-leak/detect.test.ts`**:
| Test case | Assertion |
|-----------|-----------|
| Token generation | 12-char hex string, unique per call |
| `dns.lookup` called N times with correct hostnames | Mock verifies domains match `{token}-{i}.d.echo.nocoo.cloud` |
| DNS lookup timeout (5s) | Single slow lookup doesn't block entire flow |
| Collector poll: success on first attempt | Returns result immediately |
| Collector poll: empty → retry → success | Retries up to 3 times |
| Collector poll: all retries empty | `verdict: "inconclusive"`, exit 2 |
| Collector network error | `verdict: "inconclusive"`, exit 2 |
| Verdict: user US, all resolvers US | `"no_leak"`, no `leaked: true` entries |
| Verdict: user US, one resolver CN | `"leak"`, that server has `leaked: true` |
| Verdict: no user IP available | `"inconclusive"` |
| Verdict with `expectedResolvers` CIDR match | `"no_leak"` |
| Verdict with `expectedResolvers` CIDR mismatch | `"leak"` |

**`dns-leak/output.test.ts`**:
| Test case | Assertion |
|-----------|-----------|
| Table: no_leak verdict | Shows "✓ No DNS leak detected" |
| Table: leak verdict | Shows "⚠ DNS leak detected" |
| Table: inconclusive verdict | Shows "Unable to determine" text |
| Table: resolver list formatting | Correct alignment, IP/ISP/location columns |

**`cli/args.test.ts` (additions)**:
| Test case | Assertion |
|-----------|-----------|
| `dns` parsed | command type = "dns" |
| `dns --rounds 8` | rounds = 8 |
| `dns --rounds 0` | Error: out of range |
| `dns --rounds 50` | Error: out of range |
| `dns --extended` | rounds = 8 |
| `dns-leak --rounds 3 --extended` | rounds = 3 (explicit flag wins) |

**`config/schema.test.ts` (additions)**:
| Test case | Assertion |
|-----------|-----------|
| `dnsLeak` field accepted | No validation error |
| `dnsLeak.rounds` out of range | Validation error |
| `dnsLeak.expectedResolvers` invalid CIDR | Validation error |

**`config/loader.test.ts` (additions)**:
| Test case | Assertion |
|-----------|-----------|
| No dnsLeak in config | Defaults applied (rounds: 5) |
| Partial dnsLeak config | Missing fields get defaults |

### CLI E2E Test

- Requires network access to `echo-collector.worker.hexly.ai`
- Validate full flow: lookup → poll → non-empty `dnsServers`
- Verify JSON output is parseable and has correct shape
- Skip in CI (tag: `@network`)

### macOS Unit Tests

| Test case | Assertion |
|-----------|-----------|
| DnsLeakOutput decoding (no_leak) | Valid JSON → struct, verdict = .noLeak |
| DnsLeakOutput decoding (leak) | Valid JSON → struct, leaked flags correct |
| DnsLeakOutput decoding (inconclusive) | Empty servers, verdict = .inconclusive |
| CLIBridge invokeDnsLeak exit 0 | Decodes successfully |
| CLIBridge invokeDnsLeak exit 1 | Decodes successfully (leak result) |
| CLIBridge invokeDnsLeak exit 2 | Decodes successfully (inconclusive) |
| CLIBridge invokeDnsLeak exit 3 | Throws CLIError.fatal |
| CLIBridge invokeDnsLeak exit 139 | Throws CLIError.crashed |
| DnsLeakViewModel idle → loading → success | State transitions correct |
| DnsLeakViewModel error recovery | Re-run after error works |

---

## Privacy Disclosure

This feature makes network requests to external services. Users should be informed:

**What dns-probe/KV stores:**
- Random token (12-char hex, generated fresh each test, no user identity)
- DNS resolver exit IPs (the IP of the recursive resolver, NOT the user's IP)
- Stored in Cloudflare KV with 5-minute TTL, then auto-deleted
- dns-probe only sees UDP queries from recursive resolvers, never the end-user IP

**What HTTPS services see:**
- Requests to `1.1.1.1/cdn-cgi/trace`, `echo-collector.worker.hexly.ai`, and `echo.nocoo.cloud` are standard HTTPS — the server sees the client's egress IP in the TCP connection
- These services do NOT persist the request source IP in the detection result or KV store
- Standard server access logs may exist per each service's own retention policy (Cloudflare Workers: no persistent logging by default)

**What is NOT stored in detection results:**
- User's browsing history or domain query list
- Any persistent identifiers linking tests across sessions

**Network requests made during detection:**
1. `dns.lookup()` to `{token}-{n}.d.echo.nocoo.cloud` (triggers system DNS resolution)
2. HTTPS fetch to `1.1.1.1/cdn-cgi/trace` (get user exit IP for geo comparison)
3. HTTPS fetch to `echo-collector.worker.hexly.ai/result/{token}` (poll results)
4. HTTPS fetch to `echo.nocoo.cloud/api/ip?ip=...` (enrich resolver IPs with geo)

CLI table output will include a one-line notice: `DNS queries sent to d.echo.nocoo.cloud (results expire in 5 min)`

---

## Boundaries

### Always Do
- Use `dns.promises.lookup()` (getaddrinfo / system resolver path)
- Logical timeout (5s) per lookup via `Promise.race`; cannot cancel OS getaddrinfo
- Exit 0/1/2 always emit valid JSON when `--json` is specified
- Poll collector with retries (not single fixed wait)
- Validate `--rounds` range (1–20) at parse time
- Keep DnsLeakView independent from probe/ping refresh cycle
- Show "inconclusive" (not "no leak") when evidence is insufficient

### Ask First
- Adding new npm dependencies
- Changing existing config schema in breaking ways
- Modifying CLIBridge's existing `invoke()` method signature

### Never Do
- Ship without unit tests for detection logic, args, config, and output
- Call collector's internal `/report` endpoint from client
- Block the main probe/ping flow while DNS leak test runs
- Hard-code IP addresses as "safe" — always user-configurable
- Display "No leak detected" without sufficient evidence (need user IP geo + resolver geo, OR expectedResolvers config)
- Use `dns.resolve4()` / c-ares (bypasses VPN scoped DNS on macOS)
- Claim `dns.Resolver.cancel()` or `AbortController` can cancel `dns.lookup()` (it cannot — getaddrinfo is fire-and-forget)

---

## Implementation Order

1. **CLI types** — `dns-leak/types.ts` + `dns-leak/cidr.ts`
2. **Config schema** — types.ts, schema.ts, loader.ts + tests
3. **CLI args** — parse `dns-leak` subcommand + tests
4. **CLI detect logic** — `dns-leak/detect.ts` + tests
5. **CLI output** — `dns-leak/output.ts` + tests
6. **CLI integration** — wire into `cli.ts`
7. **CLI E2E** — network integration test
8. **macOS model** — `DnsLeakOutput` / `DnsServer` in Models.swift
9. **macOS CLIBridge** — `invokeDnsLeak()` method + tests
10. **macOS DnsLeakViewModel** — state machine + tests
11. **macOS DnsLeakView** — full UI with all states

---

## API Reference (Echo Collector)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `https://echo-collector.worker.hexly.ai/result/{token}` | GET | Fetch detected resolver exit IPs |
| `https://echo-collector.worker.hexly.ai/health` | GET | Health check |

**Response** (`GET /result/{token}`):
```json
{
  "token": "a1b2c3d4e5f6",
  "dns_servers": ["114.114.114.114", "8.8.8.8"],
  "count": 2,
  "expires_in": 280
}
```

**Empty/expired token:**
```json
{
  "token": "a1b2c3d4e5f6",
  "dns_servers": [],
  "count": 0
}
```

**Notes**:
- Collector API uses `dns_servers` (snake_case). CLI normalizes to `dnsServers` (camelCase).
- Token format: 12-char hex string (matches `crypto.randomBytes(6).toString('hex')` output).
- The `dns_servers` array contains **resolver exit IPs** — the egress IP of whatever recursive resolver handled the query. This is NOT necessarily the IP the user typed into their DNS settings (e.g., user sets `1.1.1.1` but Cloudflare's resolver might egress from `172.64.x.x`).
