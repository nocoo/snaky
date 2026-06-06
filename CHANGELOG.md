# Changelog

## v1.0.5 (2026-06-06)

### Fixes

- **CLI not detected at startup** — `CLIDiscovery` shells out to `zsh -l -c "which snaky"` as a last resort. On macOS, login shells only source `.zprofile` / `.zshenv`, but Node version managers (nvm, fnm, asdf, mise, rtx) install their PATH-modification snippet in `.zshrc`, which is only sourced by interactive shells. Switch the shell invocation from `zsh -l -c` to `zsh -i -l -c` so `.zshrc` is loaded and these tools' shims resolve correctly. Add NSLog instrumentation to `CLIDiscovery.discover()` so future regressions surface in `Console.app`.
- **`Info.plist` + `build.sh`** — bundle id `ai.hexly.snaky` got polluted in macOS Tahoe ControlCenter's blocked-host list during v1.0.4 testing (one accidental direct-exec is enough to permanently brand a bundle id as ephemeral). Move to a fresh `ai.hexly.snakybar` so first launch is treated as a clean app-process registration.



### Fixes

- **macOS menu bar icon still invisible — true root cause found** — the v1.0.1–v1.0.3 "SystemUI cooldown" hypothesis was wrong. The real issue: macOS 26 Tahoe ControlCenter blocks `NSStatusItem` registration whenever the host process is started as `anon<>` (anything launched by directly exec'ing the binary, including `./Snaky.app/Contents/MacOS/Snaky`, `swift run`, or `.build/release/Snaky`). Within ~15ms ControlCenter walks `Host properties initialized` → `Created ephemaral instance ... with positioning .ephemeral` → `Moving host to blocked list`, and the bundle id is then **permanently blocked** on that machine — no reinstall / re-sign / restart helps. Working menubar apps (Gecko, Raycast, SwiftBar, Tailscale…) are launched via LaunchServices and appear as `app<application.X>` processes, which ControlCenter accepts normally.
- **`Info.plist` + `build.sh`** — revert bundle id to plain `ai.hexly.snaky` (no `.NN` suffix). The numbered suffixes were a misdiagnosis-driven workaround that piled up stale blocked entries in ControlCenter.
- **`build.sh`** — append `lsregister -f $APP_BUNDLE` so the freshly built `.app` is registered with LaunchServices before first launch. Print an explicit reminder: always launch via `open` (or Dock/Finder/Spotlight), never exec the binary directly — this is what makes the menubar icon actually appear.

## v1.0.3 (2026-05-31)

### Fixes

- **macOS menu bar icon still invisible after v1.0.2** — even with the new monochrome alpha icon and `NSStatusItem.isVisible` reporting `1`, macOS SystemUI had silently put the bundle id `ai.hexly.snaky.01` into a cooldown / hidden list after many dev relaunches. The status item was created and the icon loaded, but ControlCenter refused to draw it (no icon, no title, nothing). Renamed bundle id to `ai.hexly.snaky.02` (Info.plist + `build.sh` codesign identifier) so SystemUI treats it as a fresh app — the icon appears immediately.

## v1.0.2 (2026-05-31)

### Fixes

- **macOS menu bar icon invisible** — the bundled `menubar-icon.png` was a full-color logo, but `StatusItemController` set `image.isTemplate = true`. In template mode AppKit ignores RGB and renders only the alpha channel; on a colorful PNG with a near-opaque alpha that produced a black square or nothing visible, depending on the menubar background. Regenerated `menubar-icon.png` as a 44×44 monochrome (black) image with the snake silhouette baked into the alpha channel, so template tinting now produces a clean, theme-adaptive icon.

## v1.0.1 (2026-05-30)

### Fixes

- **macOS menu bar icon visibility** — switch `NSStatusItem` from `squareLength` to `variableLength`. On macOS Tahoe (26) with a saturated menu bar, square-length items get assigned an off-screen frame (Y=-14) — `isVisible` reports true but the user sees nothing. Variable-length lets macOS gracefully compress and place the icon on-screen.
- **Bundle id** — rename `com.nocoo.snaky` → `ai.hexly.snaky.01` to avoid SystemUI cooldown on bundle ids that have been repeatedly relaunched during dev.
- **Asset lookup hardening** — `SnakyCore.menuBarIcon` now tries multiple `Bundle.module` layouts so the icon resolves both in `swift run` dev mode and in the installed `.app`.

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
