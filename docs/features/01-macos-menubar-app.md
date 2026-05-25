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
| Build system | Xcode project (`Snaky.xcodeproj`) |
| CLI communication | Foundation.Process → `snaky --json` |
| Target | macOS 14+ (Sonoma), Apple Silicon + Intel |
| Swift | Swift 5.9+ |

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

- App reads `snaky --version` on launch
- If version is below minimum supported, show warning with upgrade command
- App does not hard-fail on version mismatch (graceful degradation)

### Invocation Timeout & Process Lifecycle

- **Total timeout**: 90 seconds. If CLI does not exit within 90s, kill the process (SIGTERM → 2s grace → SIGKILL) and show "CLI timed out" error.
- **During refresh**: Refresh button shows spinner and is non-interactive (prevents double-invoke).
- **Cancel/re-invoke**: If user clicks Refresh while a refresh is in-flight, the previous process is killed (SIGTERM → 2s grace → SIGKILL) and a new one starts.
- **Partial stdout**: If CLI is killed mid-run, any stdout received so far is discarded (incomplete JSON is not parseable). App preserves the previous result and shows a "refresh failed" indicator.

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
- Refresh button (triggers new CLI invocation)
- Loading spinner during fetch (button disabled)
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
    case httpPing = "http-ping"
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
├── Snaky.xcodeproj
├── Snaky/                  # App shell (thin)
│   ├── SnakyApp.swift      # Entry point, AppDelegate
│   ├── StatusItem.swift    # NSStatusItem + NSPopover wiring
│   └── Info.plist
├── SnakyCore/              # Testable library
│   ├── Models/             # Decodable structs (above)
│   ├── Services/
│   │   ├── CLIBridge.swift # Process spawning, discovery, timeout
│   │   └── CLIDiscovery.swift
│   ├── ViewModels/
│   │   └── AppViewModel.swift
│   └── UI/                 # SwiftUI views
│       ├── PopoverContentView.swift
│       ├── UniqueIpSection.swift
│       ├── ProbeSection.swift
│       ├── PingSection.swift
│       ├── SetupView.swift
│       └── Components/
├── SnakyCoreTests/
│   ├── ModelDecodingTests.swift
│   ├── CLIBridgeTests.swift
│   └── Fixtures/           # JSON fixtures from CLI golden files
└── scripts/
    ├── build.sh
    └── package-dmg.sh
```

---

## Build & Development

```bash
# Build macOS app (Xcode)
cd apps/macos
xcodebuild -scheme Snaky -configuration Debug build

# Run in debug (Xcode)
open Snaky.xcodeproj  # Cmd+R in Xcode

# Or via command line
xcodebuild -scheme Snaky -configuration Debug build
./Build/Products/Debug/Snaky.app/Contents/MacOS/Snaky

# Package for distribution
./scripts/build.sh
./scripts/package-dmg.sh
```

**Prerequisite**: `snaky` CLI must be installed separately (`npm install -g @nocoo/snaky`). The app discovers it at runtime — it is never bundled.

---

## Testing Strategy (6DQ)

| Layer | Content | Trigger |
|-------|---------|---------|
| L1 Unit | Model decoding (all exit code scenarios), CLIBridge output parsing, ViewModel state transitions, discovery logic | pre-commit |
| G1 Static | `xcodebuild` strict concurrency warnings, swiftlint | pre-commit |
| L2 Integration | CLIBridge spawns real `snaky` process, verifies JSON decode end-to-end | pre-push |

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
- Double-refresh cancel: first process killed, second starts fresh
- Empty results (`summary.total == 0`): shows "No endpoints configured"

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

1. `chore: init apps/macos/ Xcode project skeleton` — menu bar app target + SnakyCore framework target + test target
2. `test: CLI JSON model decoding` — XCTest with fixture JSON files covering all exit code scenarios, complete Decodable structs
3. `feat: implement data models` — all structs/enums matching CLI JSON schema
4. `test: CLI discovery logic` — unit tests for path resolution priority
5. `feat: CLI discovery and bridge service` — process spawning, 90s timeout, exit code handling, SIGTERM/SIGKILL lifecycle
6. `feat: AppDelegate + NSStatusItem + NSPopover shell` — menu bar icon, popover wiring, activation policy
7. `feat: SwiftUI PopoverContentView` — unique IP summary, probe section, ping section with latency colors
8. `feat: refresh logic` — on-open auto-fetch, manual button, cancel/re-invoke, loading states
9. `feat: error states and setup view` — CLI not found, timeout, crash, exit code 3 handling
10. `test: integration test with real CLI` — spawns installed `snaky`, verifies end-to-end decode
