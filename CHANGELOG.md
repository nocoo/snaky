# Changelog

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
