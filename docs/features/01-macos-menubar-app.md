# macOS Menu Bar App

**Status**: Draft
**Date**: 2026-05-25

## Objective

Build a native macOS menu bar (status bar) app that visualizes Snaky CLI output. The app provides a quick-glance dashboard for IP routing and latency data without opening a terminal.

**Target users**: Snaky CLI users who want persistent, on-demand visibility into their network routing state.

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  Snaky.app (menu bar only, no dock icon)     │
├──────────────────────────────────────────────┤
│  AppDelegate (AppKit)                        │
│    ├── NSStatusItem (menu bar icon)          │
│    ├── NSPopover (panel container)           │
│    │   └── NSHostingController              │
│    │       └── PopoverContentView (SwiftUI) │
│    └── CLIBridge (Foundation.Process)        │
│        └── bundled snaky binary             │
└──────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| App shell | AppKit (NSApplication, NSStatusItem, NSPopover) |
| UI | SwiftUI |
| Build system | Swift Package Manager (no Xcode project) |
| CLI communication | Foundation.Process → `snaky --json` |
| Target | macOS 14+ (Sonoma), Apple Silicon + Intel |
| Swift | Swift 6 (Swift 5 language mode) |

### Key Decisions

- **No Xcode project** — pure SPM, same as reference project (owl)
- **Menu bar only** — `NSApp.setActivationPolicy(.accessory)`, no dock icon
- **Bundled CLI** — embedded in app bundle Resources, not dependent on PATH
- **JSON mode** — all CLI data via `snaky --json` for structured Decodable parsing
- **No auto-refresh** — data fetched on panel open + manual refresh button (MVP)

---

## Core Features (MVP)

### 1. Status Bar Icon

- SF Symbol icon (e.g., "network" or custom)
- Left-click toggles popover panel
- Right-click shows context menu (Refresh / Quit)

### 2. Popover Panel

Fixed-size panel (~360x600) with SwiftUI content:

#### Probe Section
- List of probe results showing: endpoint name, IP, location, colo, latency
- Color-coded latency (green ≤200ms, yellow 201-1000ms, red >1000ms)
- Status indicator per row (success ✓ / failure ✗)
- Unique IP summary at the top

#### Ping Section
- List of ping results showing: endpoint name, median latency, round count
- Latency color coding (same scheme)
- Per-round sparkline or mini bar chart (stretch goal)

#### Controls
- Refresh button (triggers new CLI invocation)
- Loading indicator during fetch
- Last-updated timestamp
- Error state display if CLI fails

### 3. CLI Bridge

- Spawns `snaky --json` as subprocess via Foundation.Process
- Reads stdout, decodes JSON into Swift models (mirroring CLI's FullOutput type)
- Handles: timeout, process crash, missing binary
- CLI binary path: `Bundle.main.resourcePath + "/snaky"`

---

## Data Models (Swift)

Mirrors CLI JSON output:

```swift
struct FullOutput: Decodable {
    let mode: String
    let probe: ProbeOutput?
    let ping: PingOutput?
}

struct ProbeOutput: Decodable {
    let results: [ProbeEntry]
    let summary: ProbeSummary
    let uniqueIps: [UniqueIp]
}

struct ProbeEntry: Decodable {
    let name: String
    let category: String
    let method: String
    let target: String
    let ok: Bool
    let ip: String?
    let location: String?
    let colo: String?
    let responseTimeMs: Double?
    let error: ProbeError?
}

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

---

## Project Structure

```
packages/macos/
├── Package.swift
├── Sources/
│   ├── Snaky/              # App shell (thin)
│   │   ├── SnakyApp.swift  # Entry point, AppDelegate
│   │   └── StatusItem.swift
│   └── SnakyCore/          # Testable library
│       ├── Models/         # Decodable structs
│       ├── Services/       # CLIBridge, process management
│       └── UI/             # SwiftUI views
│           ├── PopoverContentView.swift
│           ├── ProbeSection.swift
│           ├── PingSection.swift
│           └── Components/
├── Tests/
│   └── SnakyCoreTests/
├── scripts/
│   ├── build.sh
│   └── package-dmg.sh
└── Resources/
    └── snaky              # CLI binary (copied at build time)
```

---

## Build & Development

```bash
# Build CLI first (provides binary for embedding)
pnpm build

# Build macOS app
cd packages/macos
swift build

# Run in debug
swift run Snaky

# Package for distribution
./scripts/build.sh
./scripts/package-dmg.sh
```

### CLI Embedding Strategy

Build script copies `packages/cli/dist/index.js` + a Node.js runtime shim into Resources, OR bundles the compiled binary via `pkg`/`bun compile`. Decision deferred — for MVP, can shell out to system `node` with bundled JS.

**Preferred approach**: Use `bun build --compile` to produce a single native binary from the CLI, embed that in Resources. No Node.js runtime dependency.

---

## Testing Strategy (6DQ)

| Layer | Content | Trigger |
|-------|---------|---------|
| L1 Unit | Model decoding, CLIBridge output parsing, ViewModel logic | pre-commit |
| G1 Static | `swift build` (strict concurrency), swiftlint | pre-commit |
| L2 Integration | CLIBridge spawns real process, verifies JSON decode | pre-push |

---

## Boundaries

### Always Do
- Use `--json` mode for all CLI communication
- Handle CLI failure gracefully (show error state, don't crash)
- Keep app shell thin, all logic in testable SnakyCore library
- Respect system appearance (light/dark mode)

### Never Do
- Auto-refresh on a timer (explicit user action only)
- Network requests from the app itself (all via CLI)
- Require elevated permissions
- Store sensitive data

### Ask First
- Adding new CLI flags/modes for app-specific needs
- Distribution method (DMG, Homebrew cask, direct download)
- Icon design / branding

---

## Atomic Commit Plan

1. Scaffold `packages/macos/` with Package.swift + empty targets
2. Implement data models (Decodable structs matching CLI JSON)
3. Implement CLIBridge service (process spawning + JSON decode)
4. Implement AppDelegate + NSStatusItem + NSPopover shell
5. Implement SwiftUI PopoverContentView with probe/ping sections
6. Implement refresh logic (on-open + manual button)
7. Add error handling and loading states
8. Add build script for CLI binary embedding
9. Add unit tests for models + CLIBridge
10. Add integration test with real CLI invocation
