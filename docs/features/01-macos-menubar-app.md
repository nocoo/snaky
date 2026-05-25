# macOS Menu Bar App

**Status**: Draft
**Date**: 2026-05-25

## Objective

Build a native macOS menu bar (status bar) app that visualizes Snaky CLI output. The app provides a quick-glance dashboard for IP routing and latency data without opening a terminal.

**Target users**: Snaky CLI users who want persistent, on-demand visibility into their network routing state.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Snaky.app (menu bar only, no dock icon)         │
├──────────────────────────────────────────────────┤
│  AppDelegate (AppKit)                            │
│    ├── NSStatusItem (menu bar icon)              │
│    ├── NSPopover (panel container)               │
│    │   └── NSHostingController                  │
│    │       └── PopoverContentView (SwiftUI)     │
│    └── CLIBridge (Foundation.Process)            │
│        └── discovers installed snaky binary      │
└──────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| App shell | AppKit (NSApplication, NSStatusItem, NSPopover) |
| UI | SwiftUI |
| Build system | Swift Package Manager (`Package.swift`) |
| CLI communication | Foundation.Process → `snaky --json` |
| Target | macOS 14+ (Sonoma), Apple Silicon + Intel |
| Swift | Swift 6.0 |

### Key Decisions

- **Menu bar only** — `NSApp.setActivationPolicy(.accessory)`, no dock icon
- **CLI not bundled** — app discovers and invokes the user's installed `snaky` binary (per SPEC.md: "Never bundle the CLI inside the macOS app")
- **JSON mode** — all CLI data via `snaky --json` for structured Decodable parsing
- **No auto-refresh** — data fetched on panel open + manual refresh button (MVP)

---

## CLI Discovery & Invocation

### Discovery Priority (stop at first success)

1. User-configured path in preferences (persisted in UserDefaults)
2. Well-known install paths (checked in order):
   - `/opt/homebrew/bin/snaky` (Apple Silicon Homebrew)
   - `/usr/local/bin/snaky` (Intel Homebrew / npm global)
   - `~/.local/bin/snaky` (user-local installs)
3. Shell-based lookup: invoke `/bin/zsh -l -c "which snaky"` (login shell to pick up PATH from `.zshrc`/`.zprofile`)

**Why login shell**: GUI apps on macOS do not inherit the user's interactive shell PATH. A login shell (`-l`) sources profile files where nvm/fnm/homebrew typically add their paths.

**Timeout**: If login shell hangs or takes >3s, kill it and fall back to hardcoded paths only.

### When CLI Not Found

- Show a setup view (not just an error)
- Display installation commands: `npm install -g @nocoo/snaky`
- "Browse..." button to manually select binary
- "Re-detect" button to retry discovery
- App remains usable for configuration but probe features are disabled

### Version Compatibility

- App reads `snaky --version` on launch and displays it in the panel footer
- MVP does not enforce a minimum version check (graceful degradation — parse what you can)
- Post-MVP: if version parsing is needed, define `minimumCLIVersion` as a constant in source

### Invocation Timeout & Process Lifecycle

- **Total timeout**: 90 seconds. If CLI does not exit within 90s, kill the process (SIGTERM → 2s grace → SIGKILL) and show "CLI timed out" error.
- **During refresh**: Refresh button label changes to "Cancel". Clicking it kills the in-flight process (SIGTERM → 2s grace → SIGKILL) and restores the button to "Refresh" with previous results preserved.
- **Partial stdout**: If CLI is killed mid-run (cancel or timeout), any stdout received so far is discarded (incomplete JSON is not parseable). App preserves the previous result and shows a "refresh cancelled" or "timed out" indicator.

### Exit Code Handling

| Exit code | Meaning | App behavior |
|-----------|---------|-------------|
| 0 | All probes succeeded | Parse stdout JSON, display results normally |
| 1 | Some probes failed (partial) | Parse stdout JSON, display results (failures shown inline per endpoint) |
| 2 | All probes failed | Parse stdout JSON, display results (all rows show error state) |
| 3 | Fatal error (bad config) | No valid JSON on stdout; show error from stderr |
| Other / crash | Unexpected | Show "CLI crashed" error state, preserve previous results |
| Timeout (90s) | CLI hung | Kill process, show "timed out" error, preserve previous results |

**Key rule**: Exit codes 0, 1, 2 ALL produce valid, complete JSON on stdout. Always attempt to parse stdout first; only treat as fatal error if JSON parsing fails or exit code is 3+.

---

## Core Features (MVP)

### 1. Status Bar Icon

- SF Symbol icon (e.g., "network" or custom)
- Left-click toggles popover panel
- Right-click shows context menu (Refresh / Quit)

### 2. Popover Panel

Fixed-size panel (~360x600) with SwiftUI content:

#### Unique IP Summary (top)
- Grouped by IP: flag/location + IP address + endpoint count
- Null location (from http-header method) displayed as "—"

#### Probe Section
- List of probe results: endpoint name, IP, location, colo, latency
- Color-coded latency (green ≤200ms, yellow 201-1000ms, red >1000ms)
- Status indicator per row (✓ success / ✗ failure with error code)
- Fallback indicator when `usedFallback: true` (show `resolvedTarget`)

#### Ping Section
- List of ping results: endpoint name, tag, median latency
- Latency color coding (same scheme)
- Per-round dots: green for success, red for -1 rounds
- Partial success: `ok: true` with some rounds failed

#### Controls
- Refresh button (triggers new CLI invocation); during fetch shows spinner and changes label to "Cancel" (remains interactive)
- Last-updated timestamp
- Error state display (CLI not found / timed out / crashed / exit code 3)

### 3. Data Refresh Behavior

- **Panel open**: Automatically invokes `snaky --json` when popover appears
- **Manual refresh**: User clicks refresh button
- **Stale display**: Previous results remain visible until new results arrive
- **Error recovery**: After error, next refresh attempts a fresh invocation

---

## Data Models (Swift)

Complete mapping of CLI JSON schema (per SPEC.md):

```swift
enum RunMode: String, Decodable {
    case all
    case probe
    case ping
}

struct FullOutput: Decodable {
    let mode: RunMode
    let probe: ProbeOutput?
    let ping: PingOutput?
}

// MARK: - Probe

struct ProbeOutput: Decodable {
    let results: [ProbeEntry]
    let summary: ProbeSummary
    let uniqueIps: [UniqueIp]
}

struct ProbeSummary: Decodable {
    let total: Int
    let succeeded: Int
    let failed: Int
}

struct UniqueIp: Decodable {
    let ip: String
    let location: String?
    let count: Int
}

struct ProbeEntry: Decodable {
    let name: String
    let category: String
    let method: ProbeMethod
    let target: String
    let resolvedTarget: String?
    let ok: Bool
    let ip: String?
    let location: String?
    let colo: String?
    let responseTimeMs: Double?
    let usedFallback: Bool
    let error: ProbeError?
}

enum ProbeMethod: String, Decodable {
    case cftrace
    case httpHeader = "http-header"
}

struct ProbeError: Decodable {
    let code: ErrorCode
    let message: String
}

enum ErrorCode: String, Decodable {
    case timeout = "TIMEOUT"
    case dnsFailed = "DNS_FAILED"
    case connectionRefused = "CONNECTION_REFUSED"
    case tlsError = "TLS_ERROR"
    case httpError = "HTTP_ERROR"
    case parseError = "PARSE_ERROR"
    case redirect = "REDIRECT"
    case headerMissing = "HEADER_MISSING"
    case allFailed = "ALL_FAILED"
    case unknown = "UNKNOWN"
}

// MARK: - Ping

struct PingOutput: Decodable {
    let results: [PingResult]
}

struct PingResult: Decodable {
    let name: String
    let tag: String
    let ok: Bool
    let medianMs: Double?
    let rounds: [Double]
    let error: ProbeError?
}
```

**Notes**:
- `responseTimeMs` is `Double?`: present (number) when measurable, `null` for DNS_FAILED/CONNECTION_REFUSED/TLS_ERROR
- `resolvedTarget` only present when `usedFallback: true`
- Ping `rounds` array: positive = success ms, `-1` = round failed
- `location` is always `null` for `http-header` method (CLI does not do GeoIP)

---

## Project Structure

```
apps/macos/
├── Package.swift
├── Sources/
│   ├── Snaky/                  # App shell (thin)
│   │   ├── SnakyApp.swift      # Entry point
│   │   ├── AppDelegate.swift   # NSApplication lifecycle
│   │   └── StatusItemController.swift
│   └── SnakyCore/              # Testable library
│       ├── Models/             # Decodable structs (above)
│       ├── Services/
│       │   ├── CLIBridge.swift # Process spawning, discovery, timeout
│       │   └── CLIDiscovery.swift
│       ├── ViewModels/
│       │   └── AppViewModel.swift
│       └── UI/                 # SwiftUI views
│           ├── PopoverContentView.swift
│           ├── UniqueIpSection.swift
│           ├── ProbeSection.swift
│           ├── PingSection.swift
│           ├── SetupView.swift
│           └── Components/
├── Tests/
│   └── SnakyCoreTests/
│       ├── ModelDecodingTests.swift
│       ├── CLIBridgeTests.swift
│       └── Fixtures/           # JSON fixtures maintained here, manually synced from CLI schema
└── .swiftlint.yml
```

---

## Build & Development

```bash
# Build macOS app (SPM)
cd apps/macos
swift build

# Run tests
swift test

# Build with warnings-as-errors
swift build -Xswiftc -warnings-as-errors

# Run after build
.build/debug/Snaky
```

**Prerequisite**: `snaky` CLI must be installed separately (`npm install -g @nocoo/snaky`). The app discovers it at runtime — it is never bundled.

**Packaging**: DMG/distribution packaging is future work (not yet scripted).

---

## Testing Strategy (6DQ)

### Coverage Requirements

- **Line coverage**: ≥ 95% on SnakyCore target
- **Exclusions**: Only `Snaky/` app shell entry point (AppDelegate bootstrap, NSApplication lifecycle) may be excluded. All SnakyCore code must be covered.
- **CI gate**: Coverage below threshold fails the build

### Lint & Static Analysis (G1)

- **Swift compiler**: `-warnings-as-errors` — zero warnings allowed
- **Strict concurrency**: `SWIFT_STRICT_CONCURRENCY=complete`
- **SwiftLint**: `--strict` mode, 0 violations (warning or error)
- **Trigger**: pre-commit (runs in parallel with L1 unit tests)

### Test Layers

| Layer | Content | Trigger | Tool |
|-------|---------|---------|------|
| L1 Unit | Model decoding, CLIBridge parsing, ViewModel state, discovery logic | pre-commit (<30s) | Swift Testing |
| G1 Static | `swift build -Xswiftc -warnings-as-errors` (strict concurrency) + swiftlint --strict | pre-commit | SPM + swiftlint |
| L2 Integration | CLIBridge spawns real `snaky` process, verifies JSON decode end-to-end | pre-push (<60s) | Swift Testing |

### Key Test Scenarios

- Parse CLI JSON: mode=all success fixture → all fields populated
- Parse CLI JSON: mode=probe with partial failures (`ok: false`, error codes)
- Parse CLI JSON: fallback used (`usedFallback: true`, `resolvedTarget` present)
- Parse CLI JSON: ping with `-1` rounds, partial success
- Exit code 1: stdout has valid JSON, results display with inline errors
- Exit code 2: stdout has valid JSON, all rows show failure
- Exit code 3: no JSON on stdout, app shows fatal error from stderr
- CLI not found: state transitions to setup view
- CLI timeout (90s): process killed, previous results preserved
- Double-refresh cancel: click Cancel kills process, button reverts to Refresh, previous results preserved
- Empty results (`summary.total == 0`): shows "No endpoints configured"
- ViewModel state machine: idle → loading → success / error transitions
- Discovery fallback chain: configured path → well-known paths → login shell → not found

---

## Boundaries

### Always Do
- Use `--json` mode for all CLI communication
- Parse stdout for exit codes 0, 1, 2 (all produce valid JSON)
- Handle CLI failure gracefully (show error state, don't crash)
- Keep app shell thin, all logic in testable SnakyCore library
- Respect system appearance (light/dark mode)
- Kill previous CLI process before starting a new one
- Preserve previous results on refresh failure

### Never Do
- Bundle the CLI inside the app (keep them independently versioned)
- Auto-refresh on a timer (explicit user action only in MVP)
- Network requests from the app itself (all via CLI)
- Require elevated permissions
- Store sensitive data
- Treat exit code 1/2 as fatal errors (they have valid JSON output)

### Ask First
- Adding new CLI flags/modes for app-specific needs
- Distribution method (DMG, Homebrew cask, direct download)
- Icon design / branding
- Adding auto-refresh with configurable interval (post-MVP)

---

## Atomic Commit Plan

Each step = one atomic commit. TDD: tests written before or alongside implementation. Every commit must pass `swift build -Xswiftc -warnings-as-errors` + swiftlint --strict.

---

### Step 1 — `chore: init apps/macos/ SPM package skeleton`

- Create `apps/macos/Package.swift` with 3 targets:
  - `Snaky` (executableTarget, menu bar agent)
  - `SnakyCore` (library, all testable logic)
  - `SnakyCoreTests` (testTarget)
- Configure `Package.swift`: `.enableExperimentalFeature("StrictConcurrency")`
- Add `.swiftlint.yml` with strict rules, 0 tolerance
- Verify: `swift build` succeeds with 0 warnings

---

### Step 2 — `test: CLI JSON model decoding`

**Tests (red phase — written first, all fail):**
- `testDecodeFullOutputModeAll` — mode=all, both probe and ping present
- `testDecodeFullOutputModeProbe` — mode=probe, ping is null
- `testDecodeFullOutputModePing` — mode=ping, probe is null
- `testDecodeProbeEntrySuccess` — all fields: ip, location, colo, responseTimeMs, usedFallback=false
- `testDecodeProbeEntryWithFallback` — usedFallback=true, resolvedTarget present
- `testDecodeProbeEntryFailure` — ok=false, error code/message, responseTimeMs=null (DNS_FAILED)
- `testDecodeProbeEntryFailureWithTime` — ok=false, TIMEOUT, responseTimeMs present
- `testDecodeProbeSummary` — total/succeeded/failed counts
- `testDecodeUniqueIps` — ip, location (nullable), count
- `testDecodePingResultSuccess` — ok=true, medianMs, rounds array (positive values)
- `testDecodePingResultPartial` — ok=true, some rounds=-1, medianMs from successful only
- `testDecodePingResultAllFailed` — ok=false, medianMs=null, all rounds=-1, error
- `testDecodeErrorCodes` — each ErrorCode enum case round-trips correctly

**Fixtures (JSON files in `SnakyCoreTests/Fixtures/`):**
- `full-output-all-success.json`
- `full-output-probe-only.json`
- `full-output-ping-only.json`
- `full-output-partial-failure.json`
- `full-output-with-fallback.json`

---

### Step 3 — `feat: implement data models`

**Implementation (green phase — make tests pass):**
- All structs/enums from Data Models section: `FullOutput`, `RunMode`, `ProbeOutput`, `ProbeSummary`, `UniqueIp`, `ProbeEntry`, `ProbeMethod`, `ProbeError`, `ErrorCode`, `PingOutput`, `PingResult`
- All tests from Step 2 pass
- Coverage: 100% on Models/ directory

---

### Step 4 — `test: CLI discovery logic`

**Tests:**
- `testDiscoveryUsesConfiguredPathFirst` — UserDefaults has path → returns it without checking others
- `testDiscoveryConfiguredPathInvalid` — configured path doesn't exist → falls through to well-known
- `testDiscoveryWellKnownPaths` — `/opt/homebrew/bin/snaky` exists → returns it
- `testDiscoveryWellKnownOrder` — checks Apple Silicon path before Intel path
- `testDiscoveryLoginShellFallback` — well-known paths miss, shell returns path → uses it
- `testDiscoveryLoginShellTimeout` — shell hangs >3s → killed, returns nil
- `testDiscoveryNotFound` — all methods fail → returns nil

**Design**: `CLIDiscovery` uses protocol `FileExistenceChecker` and `ShellExecutor` for DI/testability.

---

### Step 5 — `feat: CLI discovery and bridge service`

**Implementation:**
- `CLIDiscovery` — path resolution with DI protocols
- `CLIBridge` — `func invoke() async throws -> FullOutput`
  - Spawns `Foundation.Process` with discovered path + `["--json"]`
  - Collects stdout via `Pipe`, applies 90s timeout (`Task.sleep` + process kill)
  - Exit code routing: 0/1/2 → decode JSON; 3 → throw `CLIError.fatal(stderr)`; crash → throw `CLIError.crashed`
  - SIGTERM → 2s grace → SIGKILL on cancel/timeout
- `CLIError` enum: `.notFound`, `.fatal(String)`, `.crashed(Int32)`, `.timeout`, `.decodingFailed(Error)`

**Tests:**
- `testBridgeExitCode0` — mock process exits 0 with valid JSON → decoded
- `testBridgeExitCode1` — mock exits 1 with valid JSON → decoded (not thrown)
- `testBridgeExitCode2` — mock exits 2 with valid JSON → decoded (not thrown)
- `testBridgeExitCode3` — mock exits 3, no JSON → throws .fatal with stderr content
- `testBridgeTimeout` — mock process sleeps >90s → killed, throws .timeout
- `testBridgeCrash` — mock exits 139 (SIGSEGV) → throws .crashed
- `testBridgeMalformedJSON` — valid exit code but garbage stdout → throws .decodingFailed

---

### Step 6 — `feat: AppDelegate + NSStatusItem + NSPopover shell`

- `AppDelegate`: sets `.accessory` activation policy, creates status item
- `StatusItem`: NSStatusItem with SF Symbol, left-click → toggle popover, right-click → context menu (Quit)
- `NSPopover` with `.transient` behavior, sized 360x600
- Content: placeholder SwiftUI view ("Loading...")
- No tests needed for pure AppKit wiring (excluded from coverage target)

---

### Step 7 — `feat: SwiftUI PopoverContentView`

**Implementation:**
- `PopoverContentView` — container with sections
- `UniqueIpSection` — displays `uniqueIps` with location flags
- `ProbeSection` — list of probe results, latency colors, ✓/✗ icons, fallback badge
- `PingSection` — list of ping results, median latency, round dots

**Tests (ViewModel, not View):**
- `testViewModelProbeRowMapping` — ProbeEntry → display model (icon, color, subtitle)
- `testViewModelLatencyColor` — ≤200ms green, 201-1000ms yellow, >1000ms red
- `testViewModelPingRoundDots` — rounds array → dot colors (green/red for -1)
- `testViewModelNullLocationDisplay` — location=nil → "—"
- `testViewModelFallbackDisplay` — usedFallback → shows resolvedTarget

---

### Step 8 — `feat: refresh logic`

**Implementation:**
- `AppViewModel`: state machine `idle → loading → success(FullOutput) | error(CLIError)`
- Popover `onAppear` → triggers refresh
- Refresh button → calls `viewModel.refresh()`
- During loading: button shows spinner + "Cancel", clicking calls `viewModel.cancel()`
- Cancel: kills in-flight process, state reverts to previous (idle or last success)

**Tests:**
- `testRefreshOnAppear` — opening panel triggers invoke
- `testRefreshSuccess` — state transitions: idle → loading → success
- `testRefreshFailure` — state transitions: idle → loading → error
- `testCancelDuringRefresh` — state transitions: loading → previous state preserved
- `testRefreshAfterSuccess` — new success replaces old; old displayed during loading
- `testRefreshAfterError` — error state → loading → new result

---

### Step 9 — `feat: error states and setup view`

**Implementation:**
- `SetupView` — shown when CLI not found (install commands, Browse button, Re-detect button)
- Error banner in popover for timeout/crash/exit-3
- Previous results remain visible below error banner

**Tests:**
- `testNotFoundShowsSetupView` — discovery returns nil → SetupView presented
- `testTimeoutShowsErrorBanner` — .timeout → error banner text matches
- `testCrashedShowsErrorBanner` — .crashed → shows exit code in banner
- `testFatalShowsStderrMessage` — .fatal(msg) → banner shows msg
- `testPreviousResultsPreservedOnError` — after success, refresh fails → old data still shown

---

### Step 10 — `test: integration test with real CLI`

- Requires `snaky` installed (skipped via `.enabled(if:)` trait if not available)
- Spawns real `snaky --json --timeout 3000` with short timeout
- Verifies: stdout parses into `FullOutput`, mode == .all, probe/ping both non-nil
- Verifies: `snaky --version` returns parseable semver string

---

### Quality Gates Summary

| Gate | Requirement | Enforced at |
|------|-------------|-------------|
| L1 Coverage | ≥ 95% line on SnakyCore | Every commit |
| G1 Compiler | 0 warnings (`swift build -Xswiftc -warnings-as-errors`) | Every commit |
| G1 SwiftLint | 0 violations (`--strict`) | Every commit |
| G1 Concurrency | `SWIFT_STRICT_CONCURRENCY=complete` | Every commit |
| L2 Integration | Real CLI round-trip | pre-push |
