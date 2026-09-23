# Snaky

CLI and native macOS menu-bar application for routing, HTTP latency and DNS checks.
Profile: native-hybrid.
Human overview: [README.md](README.md). Direction: [documentation](docs/README.md). Frameworks must preserve this handbook. Maintain this root `AGENTS.md` as the only project handbook; do not create a `CLAUDE.md` alias, copy or import.

## Sources of Truth

This file is the quality contract; hooks, CI and config are enforcement. Close implementation gaps without lowering the contract. Historical test results are not evidence of a current passing run.

| Fact | Where |
|---|---|
| Human docs | [README.md](README.md), [native design](docs/features/01-macos-menubar-app.md) |
| Version | root `package.json`; bump script synchronizes CLI package, tsup injects root version |
| Packages | `packages/cli/package.json`, `apps/macos/Package.swift`, pnpm workspaces |
| Enforcement | `.husky`, CLI Vitest configs, Biome and CI |
| Release details | [CLI development/release](docs/01-development-release.md) |
| Accidents | [Retrospective.md](Retrospective.md) |
| Machine workflow | global `AGENTS.md` and Git rules |

## Project Invariants

- Node CLI supports Node ≥22; verify dependency engines before upgrades, including undici compatibility.
- The native app invokes the installed CLI; preserve streamed progress and distinguish inconclusive DNS evidence from proof of a leak.
- Start the macOS app through Finder/LaunchServices or `open`, never directly execute its bundled binary. Preserve variableLength status-item behavior and LaunchServices registration.
- Keep global CLI exception/rejection handlers writing errors to stderr before exit; diagnose child-process failures from actual output.
- Default user config lives at `~/.config/snaky/config.json`; optional Echo credentials live separately at `~/.snaky`, never in tracked files.
- Root version is authoritative; synchronize package metadata/lockfile through the existing bump workflow.

## Stack / Layout

| Lane | Path / choice |
|---|---|
| CLI | `packages/cli`, TypeScript / tsup ESM, Node ≥22 |
| Native app | `apps/macos`, Swift 6 / macOS 14+ |
| Package / scripts | pnpm 10.34.4; Bun runs release scripts |
| Tests | CLI Vitest unit/binary E2E; Swift native unit/integration suites |

## Commands

Run CLI commands from root after a frozen pnpm install. Run Swift commands from `apps/macos` with full Xcode selected for Swift Testing. Native desktop checks use a separately bundled test app.

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run test:coverage
pnpm run test:e2e
(cd apps/macos && swift build -Xswiftc -warnings-as-errors)
(cd apps/macos && swift test)
(cd apps/macos && swiftlint --strict)
```

## Verification

6DQ = L1/L2/L3 + G2 + D1 (test isolation); the former G1 dimension was merged into L1 on 2026-09-21, per lane. Status: `enforced`, `planned`, `manual`, or `N/A`; partial enforcement below does not certify the full required bar.
L1 requires statements, branches, functions and lines each ≥95%, with no skipped/focused tests; preserve any stricter package threshold. Native tools must identify unmeasured metrics as gaps. L1 also includes check-only strict analysis/formatting with zero errors/warnings (the former G1 contract). G2 requires dependency and secret scans, with missing required scanners failing.

| Dimension | Status | Required proof and current evidence/gap |
|---|---|---|
| L1 CLI (incl. former G1 CLI static) | planned | Vitest coverage sets lines 95% and branches 90%, omitting functions/statements; hook/CI run tests without coverage. Typecheck and Biome run in hooks/CI; Biome does not fail on every warning and historically allows informational assertions. |
| L1 Swift (incl. former G1 Swift static) | planned | Hook runs Swift tests only on full-Xcode hosts; no measured four-metric coverage gate. Conditional warning-as-error build/SwiftLint; CLT-only hosts skip this lane and CI has no native job. |
| L2 integration | planned | CLI binary and conditional Swift IntegrationTests run; complete locally isolated probe/DNS integration coverage is not established. |
| L3 CLI / native | manual | CI/pre-push exercise built CLI processes; real network routing and native menu-bar workflows require explicit acceptance. |
| G2 | planned | CI scans pnpm lock/secrets; local pre-push silently skips missing scanners, and native security scope remains incomplete. |
| D1 | planned | Isolate config/fixtures and test-native preferences from everyday files; no complete physical-isolation/cleanup gate. |

Pre-commit runs CLI types/lint/tests in parallel plus conditional Swift checks. Pre-push builds/tests CLI and conditionally runs Swift integration alongside security. Full Xcode detection depends on `xcode-select -p`; CLT skips are visible gaps, not passing Swift checks. Hooks test the working tree.

Target hooks: pre-commit checks unified L1 (types, check-only lint, coverage) against the index snapshot (`git checkout-index`) in <30s; pre-push checks L2 and G2 in parallel against every stdin push ref/commit in <3min, plus build where applicable. L3 runs in CI or an explicit manual lane.
Never bypass commit/push hooks, force-push, or use autofix in checks. Documentation changes do not authorize deploying or implementing new gates.

## Resources / Isolation

Use test-owned `--config` files and local fixtures; do not overwrite default user config or change VPN/system proxy settings. Network probes contact real endpoints, so separate offline checks from requested live acceptance.

## Operations / Release

Follow [release details](docs/01-development-release.md). The Bun release script can commit/tag/npm-publish; run only with release authorization. Preserve annotated version metadata and synchronize pnpm lockfile after a bump. Native app packaging/LaunchServices behavior must remain intact.

## Retrospective

Move accident narratives to [Retrospective.md](Retrospective.md); keep at most about ten concise recurring project rules here. Put architecture and operational detail in linked docs.

- Never launch a menu-bar bundle by executing its internal binary.
- Verify runtime engine compatibility and retain useful child error diagnostics.
