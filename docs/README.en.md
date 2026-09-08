<p align="center">
  <img src="../assets/brand/icon-rounded.png" alt="Snaky" width="128" height="128" />
</p>

<h1 align="center">Snaky</h1>

<p align="center"><strong>VPN and proxy routing checks</strong><br>Inspect egress IPs · Measure HTTP latency · Check DNS resolvers</p>

<p align="center">
  <a href="../README.md">简体中文</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nocoo/snaky"><img src="https://img.shields.io/npm/v/@nocoo/snaky" alt="npm" /></a>
  <a href="https://github.com/nocoo/snaky/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/nocoo/snaky/ci.yml?branch=main" alt="CI" /></a>
  <img src="https://img.shields.io/badge/CLI-macOS%20%7C%20Linux-blue" alt="CLI: macOS and Linux" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-339933" alt="Node.js >= 22" />
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
</p>

---

## What it does

Snaky brings destination egress IPs, HTTP connection latency and DNS resolvers into one view to help you check whether VPN or proxy routing matches your expectations. It provides a CLI and a native macOS menu bar app for checking a network change or a routing rule update, with structured output for scripts.

## Features

- **Egress IP probes**: read Cloudflare trace or selected HTTP response headers, show the IP for each destination and group repeated IPs. Trace can also provide country/region and CDN node information.
- **HTTP latency measurements**: warm up connections, send multiple request rounds and display the median of successful requests alongside per-round results.
- **DNS resolver checks**: collect resolver egress IPs through requests to random hostnames, then evaluate them against expected ranges or geographic information. Insufficient evidence produces `inconclusive`.
- **Progressive output**: update the terminal UI as probes finish, with static tables, final JSON and per-event NDJSON output available.
- **Configurable targets and proxies**: built-in targets are grouped by tier and category; add or remove custom targets, enable or disable targets, override configuration, and use retries or fallback domains. HTTP proxies can be detected automatically or selected explicitly.
- **macOS menu bar app**: view latency, grouped egress IPs, destination probes and DNS progress using the CLI installed on your machine.

## Usage

### CLI

Requires Node.js ≥ 22. Intended for macOS and Linux.

```bash
npm install -g @nocoo/snaky
snaky --help
snaky split
```

| Command | Purpose |
| --- | --- |
| `snaky` | Run connectivity, routing and DNS checks together |
| `snaky split [name...]` | Check egress IPs for all or named destinations |
| `snaky connect` | Measure HTTP connection latency |
| `snaky dns` | Check DNS resolvers |
| `snaky list` | List currently enabled targets |
| `snaky add <name> <domain>` | Add a destination that supports Cloudflare trace |
| `snaky remove <name>` | Remove a custom target or override; use `disable` for built-in targets |
| `snaky disable <name>` / `snaky enable <name>` | Disable or enable a target |
| `snaky config path` / `snaky config show` / `snaky config init` | Show the config path, show effective values or create a config file |

Common combinations:

```bash
snaky split --tier 2                         # Core and extended targets
snaky split --category ai --json             # AI category, final JSON
snaky split --ndjson                         # Stream individual events
snaky split --proxy http://127.0.0.1:7890     # Select an HTTP proxy
snaky split --no-proxy                      # Ignore proxy environment variables and system proxy settings
snaky dns --extended                        # Run 8 DNS rounds
```

Tier 1 targets are used by default. `--timeout <ms>` controls routing-probe timeouts, `--concurrency <n>` controls routing-probe concurrency, and `--no-color` disables color. Proxy selection checks `--proxy`, proxy environment variables, then macOS system HTTP(S) proxy settings. System-level VPN routes remain under the VPN's control.

### macOS app

Requires macOS 14 or later, with Node.js and the Snaky CLI installed separately. Download the DMG from [GitHub Releases](https://github.com/nocoo/snaky/releases/latest), drag Snaky into Applications, then launch it through Finder or run:

```bash
open /Applications/Snaky.app
```

The app discovers the CLI automatically. If discovery fails, retry detection or select its path manually. Launch the bundled app through Finder or `open` so its menu bar icon registers correctly.

### Configuration and DNS verdicts

The default config file is `~/.config/snaky/config.json`. Create an empty config with `snaky config init`, or select another file with `--config <path>`. User configuration merges with built-in targets; `snaky config show` prints the effective values.

Egress IP probes and latency measurements do not require an API key. If you have an Echo API key, place it in `~/.snaky` to add IP location, ISP information and geographic DNS verdicts:

```json
{
  "echoApiKey": "YOUR_ECHO_API_KEY"
}
```

DNS checks request random hostnames under `d.echo.nocoo.cloud` and retrieve resolver egress IPs from Echo Collector. Set `dnsLeak.expectedResolvers` in the config to expected IPv4 addresses or CIDRs to evaluate against those ranges first. Without that list, the current implementation uses a mainland-China versus non-mainland-China geographic heuristic, requiring an Echo key and complete location data. Missing evidence produces `inconclusive`. The result helps inspect the current request path; it does not cover every application's DNS behavior.

## Development

Run commands from the repository root. The CLI requires Node.js ≥ 22 and pnpm 10.34.4:

```bash
git clone https://github.com/nocoo/snaky.git
cd snaky
pnpm install --frozen-lockfile
pnpm build
node packages/cli/dist/index.js --help
```

`pnpm dev` rebuilds on source changes, `pnpm lint` checks code style, and `pnpm typecheck` checks TypeScript types.

The macOS app requires macOS 14+ and a Swift 6 toolchain. To compile:

```bash
swift build --package-path apps/macos
```

To create an `.app`, run the packaging script with a signing identity available on your machine. Its default configuration uses the maintainer's Apple Development identity:

```bash
bash apps/macos/scripts/build.sh --sign "YOUR_SIGNING_IDENTITY"
open apps/macos/build/release/Snaky.app
```

```text
packages/cli/     CLI, probe engine, configuration and terminal output
apps/macos/       Menu bar app, CLI bridge and Swift tests
assets/brand/     Project identity assets
scripts/          Version and release tools
docs/             Design documents and English README
```

## Tests

Run these commands from the repository root:

| Test layer | Command |
| --- | --- |
| CLI unit tests | `pnpm test` |
| CLI end-to-end tests | `pnpm build && pnpm test:e2e` |
| macOS unit tests | `swift test --package-path apps/macos --skip IntegrationTests` |
| macOS integration tests | `swift test --package-path apps/macos --filter IntegrationTests` |

CLI unit tests include local HTTP servers and simulated DNS failures. The full-run end-to-end scenario contacts external probe services. Swift tests require a full Xcode installation selected as the developer directory. macOS integration tests also require an installed CLI and network access; they skip when the CLI is unavailable. Use `pnpm test:coverage` for a CLI coverage report.

## Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![Ink](https://img.shields.io/badge/Ink-222222)
![Swift](https://img.shields.io/badge/Swift-F05138?logo=swift&logoColor=white)
![SwiftUI](https://img.shields.io/badge/SwiftUI-007AFF)
![AppKit](https://img.shields.io/badge/AppKit-555555)

| Component | Implementation |
| --- | --- |
| CLI | TypeScript, Node.js, Ink / React, Undici |
| macOS app | Swift, SwiftUI and AppKit, built with Swift Package Manager |
| Build and development | pnpm workspace, tsup, Biome |
| Tests | Vitest, Swift Testing |

Dependency versions are recorded in [CLI package.json](../packages/cli/package.json) and [Swift Package.swift](../apps/macos/Package.swift).

## Documentation

- [Documentation index](README.md)
- [TUI and endpoint tier design](architecture/01-tui-overhaul.md)
- [macOS menu bar app design](features/01-macos-menubar-app.md)
- [DNS detection design](features/02-dns-leak-detection.md)
- [Changelog](../CHANGELOG.md)

The design documents preserve earlier plans and implementation notes. Some commands and behavior have since changed; this README describes current usage.

## License

[MIT](../LICENSE) © 2026
