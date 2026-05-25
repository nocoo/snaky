# Snaky — Task List

## Phase 0: Project Scaffolding
- [ ] 0.1 Init monorepo and CLI package skeleton
- [ ] 0.2 Add build tooling (tsup) and dev scripts

## Phase 1: Core Parsers (Pure Functions)
- [ ] 1.1 cftrace response parser (TDD)
- [ ] 1.2 http-header IP extraction (TDD)
- [ ] 1.3 Domain/URL normalization (TDD)
- [ ] 1.4 IP address validation (TDD)

## Phase 2: Configuration
- [ ] 2.1 Config schema validation (TDD)
- [ ] 2.2 Config file loading and defaults merge (TDD)
- [ ] 2.3 Config mutation — add/remove/disable/enable (TDD)

## Phase 3: Probe Execution Engine
- [ ] 3.1 cftrace probe with mock server (TDD)
- [ ] 3.2 http-header probe with mock server (TDD)
- [ ] 3.3 http-ping probe with mock server (TDD)
- [ ] 3.4 Fallback domain logic (TDD)
- [ ] 3.5 Retry logic with exponential backoff (TDD)

## Phase 4: Orchestration
- [ ] 4.1 Concurrent probe runner (TDD)
- [ ] 4.2 Ping runner — multi-round with median (TDD)
- [ ] 4.3 Unique IPs summary builder (TDD)

## Phase 5: Output Formatting
- [ ] 5.1 JSON output serialization + snapshots (TDD)
- [ ] 5.2 Table output formatting + snapshots (TDD)

## Phase 6: CLI Entry Point
- [ ] 6.1 Argument parsing (TDD)
- [ ] 6.2 Exit code logic (TDD)
- [ ] 6.3 Wire CLI entry point + E2E smoke

## Phase 7: E2E & Snapshots
- [ ] 7.1 Binary invocation E2E tests
- [ ] 7.2 Golden file snapshots
- [ ] 7.3 Coverage threshold verification (≥95% line, ≥90% branch)

## Phase 8: macOS App (Deferred)
- [ ] 8.1 Init Xcode project
- [ ] 8.2 Swift JSON parsing (XCTest)
- [ ] 8.3 CLI discovery and invocation
- [ ] 8.4 Menu bar UI with probe results
- [ ] 8.5 Preferences and auto-refresh
