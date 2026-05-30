# Changelog

## v1.0.0 (2026-05-30)

### 🎉 First stable release

#### CLI

- **NDJSON streaming** — new `--ndjson` flag emits per-event lines (`probe.result`, `ping.result`, `dns.progress`, `dns.update`, `summary`, `done`). Consumers can render results as they arrive instead of waiting for a single batched JSON.
- **Streaming ping runner** — `runPing` emits a partial `PingResult` after each round so live consumers don't wait for all rounds × all targets.
- **DNS leak detection rewrite** — DNS resolution is now triggered via HTTP fetch (which flows through the system proxy / Clash sniffer / fake-ip / upstream DoH) rather than `dns.lookup`, matching browser behavior. Verdict logic updated to match net.coffee/dns: a CN resolver while user is outside CN counts as a leak; foreign DoH anycast (Google/Cloudflare US/JP/etc.) does not.
- **Probe registry cleanup** — removed 14 endpoints whose `cdn-cgi/trace` returns 401/403/404 or parse-fails: cursor, tumblr, pypi, hackernews, spotify, figma, huggingface, reddit, crates, telegram, vercel, soundcloud, twitch, binance.

#### macOS app

- **Streaming UI** — split + connect modules spawn as parallel `snaky --ndjson` subprocesses; results render incrementally instead of blocking on a 30s+ batched call. First probe row appears in ~300ms.
- **DNS Leak tab** — colorful gradient hero, animated halo + rotating arc during scanning, real-time round counter (`Round 3 of 8`) parsed from CLI progress events.
- **Click-to-copy probe row** — clicking any probe target copies its actual probe URL (`https://<host>/cdn-cgi/trace` for cftrace, full URL for http-header) with a capsule "Copied" toast.
- **IP Summary fallback** — when Echo enrichment is unavailable, the secondary line derives a Chinese country name + hit count from the country code instead of leaving the row blank.
- **Failure latency disambiguation** — failed probes (HTTP_ERROR/PARSE_ERROR/REDIRECT/HEADER_MISSING) still show their HTTP round-trip ms, but dimmed and with a tooltip clarifying it's not a healthy probe.
- **Unified visual language** — gradient capsule tab picker, gradient header buttons, color-coded section headers (Connectivity cyan/blue, IP Summary green/mint, Probes indigo/purple), animated footer status dot.

## v0.6.2 (2026-05-29)

### Fixes

- **TLS** — load macOS system root CAs so Cloudflare-China endpoints (e.g. qualcomm-cn) whose chain terminates at AAA Certificate Services verify instead of failing with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` (darwin + Node 22+, fail-safe)
- **Split output** — backfill probe Location from Echo geo when the CF trace omits `loc=`, re-injected into the live TUI before unmount so the rendered table reflects it
- **IP Summary** — align columns by display width (CJK glyphs render double-wide)

### Changes

- **DNS Leak heading** — drop the "(N rounds)" suffix and add a leading blank line

## v0.5.0 (2026-05-25)

First feature-complete release of the CLI tool.

### Features

- **Core probe engine** — cftrace (Cloudflare trace), http-header, http-ping methods
- **Configuration system** — JSON schema validation, built-in endpoint library (30+ sites), user customization
- **Concurrent execution** — probe + ping run in parallel, configurable concurrency limit
- **Retry & fallback** — exponential backoff retry, fallback domain support with metadata tracking
- **Multi-round ping** — warmup round + N measurement rounds, median calculation
- **CLI interface** — probe/ping/list/add/remove/disable/enable/config commands
- **Dual output** — JSON (Swift Decodable compatible) and colored table formats
- **Exit codes** — 0 (all pass), 1 (partial fail), 2 (all fail), 3 (user error)

### Quality

- 226 unit tests, 11 E2E tests (≥95% line, ≥90% branch coverage)
- Biome linting + TypeScript strict mode
- Husky pre-commit (G1+L1) and pre-push (L2) hooks

### Fixes (since initial development)

- Parallel probe+ping execution in "all" mode
- Fallback metadata (usedFallback, resolvedTarget) properly threaded
- Probe failure JSON uses nested error object per SPEC
- Config mutation validates name, domain, URL, headers before write
- Schema rejects domain with port/scheme/path, validates RFC 7230 headers
- Non-array endpoints/pingTargets rejected with clear error
- CLI flags use strict integer parsing (rejects trailing chars)
- Malformed JSON config exits 3 gracefully
- Version injected from package.json at build time
