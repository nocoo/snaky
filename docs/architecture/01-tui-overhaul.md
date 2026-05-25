# Design 001: TUI Overhaul & Endpoint Tier System

**Status**: Accepted  
**Version**: v0.6.0  
**Date**: 2026-05-25

## Motivation

CLI v0.5.0 is feature-complete but has UX limitations:

1. All 30+ built-in endpoints run every time — no way to have "extended" endpoints that only run on demand
2. Output is blocking: user sees nothing until all probes complete (up to 10s with timeouts)
3. Table columns put variable-width IP in the middle, causing misalignment
4. Ping results render below probe results despite being faster/more useful for quick checks

---

## Feature 1: Endpoint Tier System

### Problem

Adding 40+ new CF trace endpoints makes default runs slow. Users only want core endpoints by default.

### Design

- Add `tier: number` field to `Endpoint` and `PingTarget` types (1 = core, 2 = extended)
- Add `tier` to `Settings` (default: 1) — controls max tier to include
- Add `--tier <n>` CLI flag
- Current builtins get `tier: 1`, new additions get `tier: 2`
- Loader filters: `endpoints.filter(e => e.tier <= settings.tier)`
- User config: `"tier": 2` in settings section to always include extended

### Files

- `src/config/types.ts` — add `tier` to Endpoint, PingTarget, Settings, RawConfig
- `src/config/builtins.ts` — add `tier: 1` to all existing entries
- `src/config/loader.ts` — filter by tier after merge
- `src/config/schema.ts` — validate tier field
- `src/cli/args.ts` — add `--tier` flag parsing

---

## Feature 2: Connectivity Test (Ping) Above Probes

### Problem

Ping completes faster and is more immediately useful, but renders second.

### Design

- In `handleRun` output section: render ping table first, then probe table
- In JSON output: keep `{ mode, probe, ping }` order unchanged (stable API)
- Only affects non-JSON table output ordering

### Files

- `src/cli.ts` — swap output section order in non-JSON branch

---

## Feature 3: Real-time TUI with Progressive Updates

### Problem

User stares at blank terminal for 5-10s while probes run.

### Library

**Ink v5** — React for CLI. ESM-native, declarative components, powers Claude Code & Gemini CLI. Each probe result is a component that re-renders on state change.

### Dependencies

- `ink` (v5)
- `react` (v18+)
- `@types/react` (dev)

### Architecture

```
Runner (callback per result) → React setState → Ink re-render → stdout
                                     ↓ (on complete)
                              unmount Ink, print final static summary
```

### Design

- New module: `src/output/live.tsx` — React component tree for live TUI
- Components: `<App>` → `<PingSection>` + `<ProbeSection>`, each row is a `<ResultRow>`
- State: `useState` per result slot; runner calls `onResult(index, result)` to trigger re-renders
- Spinners: braille dots `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` for pending items
- Fallback: when stdout is not TTY (piped) or `--json`, skip Ink, use static batch output
- On completion: Ink `unmount()`, final static table written (for scroll-back readability)

### tsup config

Add `esbuildOptions: { jsx: 'automatic' }`, add `.tsx` to entry resolution.

### Runner changes

Add `onResult` callback to `runProbes` and `runPing`:

```typescript
type RunnerOpts = {
  concurrency: number;
  probeFn: (endpoint: Endpoint) => Promise<ProbeResult>;
  onResult?: (index: number, result: ProbeResult) => void;
};
```

### Files

- New `src/output/live.tsx`
- `src/runner/probe-runner.ts` — add `onResult` callback
- `src/runner/ping-runner.ts` — add `onResult` callback
- `src/cli.ts` — wire Ink renderer, respect `--json` and non-TTY
- `tsup.config.ts` — JSX support

---

## Feature 4: Column Layout & Visual Polish

### Problem

IPv6 addresses (39 chars) break table alignment when IP column is in the middle. Status/latency info needs color coding.

### Design

- **Probe table column order**: `Name | Location | Colo | Latency | IP` (IP last, variable width no longer breaks alignment)
- **Status icons**: `✓` green for success, `✗` red for failure/error (prepended to name)
- **Latency coloring**: ≤200ms green, 201-1000ms yellow, >1000ms red
- **Ping table**: same icon treatment, latency color coding
- **IP display**: last column can overflow without breaking other columns

### Files

- `src/output/table.ts` — reorder columns, add icons and color logic

---

## Feature 5: JSON Output Stability

### Problem

With TUI changes, `--json` must remain a stable, deterministic output format.

### Design

- `--json` flag already exists and works
- When `--json` is passed, NO TUI/ANSI output goes to stdout — only clean JSON
- Stderr can still have warnings/errors
- JSON schema is already tested; add edge case coverage
- Document: `--json` output goes to stdout, progress/errors to stderr

### Files

- `src/cli.ts` — ensure json mode skips live renderer
- `tests/e2e/binary.test.ts` — additional JSON stability assertions

---

## Implementation Order

1. Tier system types + schema
2. Tier system loader + CLI flag
3. Extended endpoints (tier 2)
4. Output order swap (ping above probe)
5. Column layout + icons + latency colors
6. Ink setup + tsup JSX config + live.tsx skeleton
7. Runner callbacks (`onResult`)
8. Live TUI integration + JSON stability

## Verification

- `pnpm test` — all unit tests pass
- `pnpm test:e2e` — all E2E tests pass
- `pnpm build && node dist/index.js --version` — prints version
- `pnpm build && node dist/index.js probe anthropic --json | jq .` — clean JSON
- `pnpm build && node dist/index.js` — visual inspection of live TUI
- Coverage ≥95% line, ≥90% branch maintained
