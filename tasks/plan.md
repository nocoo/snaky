# Snaky — Implementation Plan

## Context

Build `@nocoo/snaky` CLI from scratch per SPEC.md. TDD approach: write failing tests first, implement to pass, commit atomically. Target: 95%+ line coverage, 90%+ branch coverage.

## Dependency Graph

```
Phase 0 (scaffold)
  └─ Phase 1 (parsers) — pure functions, no deps
       └─ Phase 2 (config) — depends on validators from Phase 1
            └─ Phase 3 (probes) — depends on parsers + config types
                 └─ Phase 4 (orchestration) — depends on probes
                      └─ Phase 5 (output) — depends on result types
                           └─ Phase 6 (CLI entry) — depends on everything
                                └─ Phase 7 (E2E) — validates full stack
                                     └─ Phase 8 (macOS app) — separate track
```

## Phase 0: Project Scaffolding

### 0.1 — Init monorepo and CLI package skeleton
- Root: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- CLI: `packages/cli/package.json` (@nocoo/snaky, type: module)
- CLI: `packages/cli/tsconfig.json` (strict, ESM)
- CLI: `packages/cli/src/index.ts` (empty entry)
- CLI: `packages/cli/vitest.config.ts` (coverage: v8, thresholds: 95/90)
- **Verify:** `pnpm install` succeeds

### 0.2 — Add build tooling and dev scripts
- CLI: `packages/cli/tsup.config.ts` (ESM output)
- Scripts: build, dev, test, test:coverage
- **Verify:** `pnpm build` produces `dist/index.js`

---

## Phase 1: Core Parsers (Pure Functions)

### 1.1 — cftrace response parser
- File: `src/parsers/cftrace.ts` + `.test.ts`
- Function: `parseCfTrace(body: string): CfTraceResult | ParseError`
- Tests: valid response, missing fields, garbage, empty body, partial (ip only)
- **Verify:** `pnpm test` passes, covers all branches

### 1.2 — http-header IP extraction
- File: `src/parsers/http-header.ts` + `.test.ts`
- Function: `extractIpFromHeaders(headers: Headers, headerNames: string[]): string | HeaderError`
- Tests: valid IPv4/IPv6, comma-separated (PARSE_ERROR), port suffix (PARSE_ERROR), empty, missing header, whitespace trimmed
- **Verify:** `pnpm test` passes

### 1.3 — Domain/URL normalization
- File: `src/normalize.ts` + `.test.ts`
- Function: `normalizeDomain(input: string): string | NormalizeError`
- Tests: bare domain, full URL, with path, http→domain, ftp reject, port reject, trailing slash
- **Verify:** `pnpm test` passes

### 1.4 — IP address validation
- File: `src/validators/ip.ts` + `.test.ts`
- Function: `isValidIp(value: string): boolean`
- Tests: valid IPv4, valid IPv6, IPv4-mapped IPv6, garbage, empty, with port
- **Verify:** `pnpm test` passes

---

## Phase 2: Configuration

### 2.1 — Config schema validation
- File: `src/config/schema.ts` + `.test.ts`
- Function: `validateConfig(raw: unknown): Config | ConfigError[]`
- Tests: valid config, missing fields, invalid name regex, duplicates, out-of-range values, unknown keys (warning), disabled without method
- **Verify:** `pnpm test` passes

### 2.2 — Config file loading and defaults merge
- File: `src/config/loader.ts` + `.test.ts`
- Function: `loadConfig(path?: string): EffectiveConfig`
- Tests: file missing (defaults), valid merge, malformed JSON, name collision (user wins), disabled built-in, disabled user preserved
- **Verify:** `pnpm test` passes

### 2.3 — Config mutation (add/remove/disable/enable)
- File: `src/config/mutate.ts` + `.test.ts`
- Functions: add, remove, disable, enable operations
- Tests: all SPEC scenarios for each operation
- **Verify:** `pnpm test` passes

---

## Phase 3: Probe Execution Engine

### 3.1 — cftrace probe (integration with mock server)
- File: `src/probes/cftrace.ts` + `.test.ts`
- Function: `probeCftrace(domain: string, opts: ProbeOpts): Promise<ProbeResult>`
- Tests: valid trace, timeout, redirect (3xx), DNS error, non-2xx
- **Verify:** `pnpm test` passes

### 3.2 — http-header probe (integration with mock server)
- File: `src/probes/http-header.ts` + `.test.ts`
- Function: `probeHttpHeader(url: string, headers: string[], opts: ProbeOpts): Promise<ProbeResult>`
- Tests: header present/missing, invalid IP in header
- **Verify:** `pnpm test` passes

### 3.3 — http-ping probe (integration with mock server)
- File: `src/probes/http-ping.ts` + `.test.ts`
- Function: `probeHttpPing(url: string, opts: PingOpts): Promise<number | -1>`
- Tests: 200, 204, 403, 3xx followed, timeout, connection refused
- **Verify:** `pnpm test` passes

### 3.4 — Fallback domain logic
- File: `src/probes/fallback.ts` + `.test.ts`
- Function: `probeWithFallback(primary, fallback, opts): Promise<ProbeResult>`
- Tests: primary succeeds, primary fails + fallback succeeds, fallback exhausts retries
- **Verify:** `pnpm test` passes

### 3.5 — Retry logic with backoff
- File: `src/probes/retry.ts` + `.test.ts`
- Function: `withRetry<T>(fn, opts): Promise<T>`
- Tests: no retry needed, retry succeeds, all retries exhausted, backoff timing (fake timers)
- **Verify:** `pnpm test` passes

---

## Phase 4: Orchestration

### 4.1 — Concurrent probe runner
- File: `src/runner/probe-runner.ts` + `.test.ts`
- Function: `runProbes(endpoints, opts): Promise<ProbeResult[]>`
- Tests: concurrency limit, all succeed, partial fail, all fail, empty list
- **Verify:** `pnpm test` passes

### 4.2 — Ping runner (multi-round)
- File: `src/runner/ping-runner.ts` + `.test.ts`
- Function: `runPing(targets, opts): Promise<PingResult[]>`
- Tests: warmup excluded, N rounds, median calc, ALL_FAILED, partial success
- **Verify:** `pnpm test` passes

### 4.3 — Unique IPs summary builder
- File: `src/runner/summary.ts` + `.test.ts`
- Function: `buildUniqueSummary(results): UniqueIp[]`
- Tests: dedup, count, null location, sort by count desc
- **Verify:** `pnpm test` passes

---

## Phase 5: Output Formatting

### 5.1 — JSON output serialization
- File: `src/output/json.ts` + `.test.ts`
- Function: `formatJson(mode, probeResults, pingResults): string`
- Tests: mode=all/probe/ping, null sections, responseTimeMs null vs number
- Snapshot golden files
- **Verify:** `pnpm test` passes

### 5.2 — Table output formatting
- File: `src/output/table.ts` + `.test.ts`
- Function: `formatTable(probeResults, pingResults, opts): string`
- Tests: success/failure rows, null location (—), summary, no-color, empty
- Snapshot golden files
- **Verify:** `pnpm test` passes

---

## Phase 6: CLI Entry Point

### 6.1 — Argument parsing
- File: `src/cli/args.ts` + `.test.ts`
- Function: `parseArgs(argv: string[]): ParsedCommand`
- Tests: all commands, flags, invalid combos, --help, --version
- **Verify:** `pnpm test` passes

### 6.2 — Exit code logic
- File: `src/cli/exit-code.ts` + `.test.ts`
- Function: `computeExitCode(mode, probeResults, pingResults): number`
- Tests: all success→0, partial→1, all fail→2, fatal→3, empty→0, ping-only failure→0
- **Verify:** `pnpm test` passes

### 6.3 — Wire CLI entry point
- File: `src/cli.ts`
- Connects: args → config → runner → output → exit
- E2E: invoke binary, verify JSON and exit codes
- **Verify:** `pnpm build && node dist/index.js --help`

---

## Phase 7: E2E & Snapshots

### 7.1 — Binary invocation E2E
- File: `tests/e2e/binary.test.ts`
- Tests: JSON output structure, exit codes, stderr, --help, --version
- **Verify:** all E2E tests pass

### 7.2 — Golden file snapshots
- Dir: `tests/snapshots/`
- All output scenarios committed as golden files
- **Verify:** snapshot tests pass

### 7.3 — Coverage threshold verification
- Run: `pnpm test:coverage`
- Gate: ≥95% line, ≥90% branch
- **Verify:** coverage report passes thresholds

---

## Checkpoints

| After Phase | Gate Criteria |
|-------------|--------------|
| 0 | `pnpm install && pnpm build` succeeds |
| 1 | All parser tests pass, no I/O involved |
| 2 | Config load/save round-trip works |
| 3 | Probes work against mock HTTP server |
| 4 | Runner respects concurrency limit |
| 5 | JSON output matches SPEC schema exactly |
| 6 | `snaky --json` produces valid output |
| 7 | Coverage ≥95% line, ≥90% branch |

---

## Phase 8: macOS App (Deferred)

Separate track, starts after CLI Phase 7 is complete and stable.
- 8.1: Init Xcode project
- 8.2: Swift JSON parsing (XCTest with CLI golden files)
- 8.3: CLI discovery and invocation
- 8.4: Menu bar UI
- 8.5: Preferences and auto-refresh
