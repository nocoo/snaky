# Snaky

IP routing probe & latency tester CLI.

## Project Structure

- Monorepo (pnpm workspaces)
- Single publishable package: `packages/cli` → npm `@nocoo/snaky`
- Root `package.json` version is the single source of truth

## Development

```bash
pnpm install
pnpm build         # build CLI
pnpm test          # unit tests (vitest)
pnpm test:e2e      # E2E tests
pnpm lint          # biome
pnpm typecheck     # tsc --noEmit
```

## Release Process

1. Bump version (root is source of truth, syncs to packages/cli):
   ```bash
   bun scripts/bump-version.ts <patch|minor|major>
   ```

2. Release (build → test → commit → tag → npm publish):
   ```bash
   bun scripts/release.ts
   ```

3. Push:
   ```bash
   git push && git push --tags
   ```

## Version Rules

- Version lives in root `package.json` only — bump script syncs it to `packages/cli/package.json`
- `tsup.config.ts` reads version from root at build time for `__VERSION__`
- Tag format: `v{major}.{minor}.{patch}`
- Commit message: `release: v{version}`

## Conventions

- Runtime: bun for scripts, node >=20 for CLI
- Package manager: pnpm
- Linter: biome (info-level `noNonNullAssertion` is acceptable)
- Test: vitest (unit) + vitest with e2e config (E2E)
- Build: tsup (ESM, node20 target, JSX automatic)
- Pre-commit hook: husky → lint + typecheck + test

## Retrospective

### 0. macOS Tahoe ControlCenter 对 anon 进程的 NSStatusItem 永久 block

(2026-06-06 推翻原"SystemUI cooldown"假说,真因如下。)

**症状:** release `.app` 打包安装后 menubar **完全看不到** Snaky 图标。
进程在跑、`isVisible=true`、log 显示 frame 在合理坐标,但视觉上无图标。

**根因:** macOS 26 (Tahoe) ControlCenter 在 NSStatusItem 注册路径上加了一道
"ephemeral 黑名单"。当进程类型是 `anon<>` (即未通过 LaunchServices 启动),
ControlCenter 在 ~15ms 内走完:
1. `Host properties initialized`
2. `Starting to track host`
3. `Created ephemaral instance ... with positioning .ephemeral`
4. `Moving host to blocked list`  ← 永久把这个 bundle id 加入 blocked
5. 之后每次该 bundle id 启动直接 `Starting to track blocked host`

直接 exec (`./.app/Contents/MacOS/Snaky`、`swift run`、`.build/release/Snaky`)
都触发这条路径。一旦被 block,**这个 bundle id 在这台机器上永久作废**——
`displayablemenuextras` 里的 displayableInfos 永远是空数组,换 ControlCenter
重启/删 prefs 都救不回来。

**关键证据:**
- 工作的 menubar app (Gecko、Raycast、SwiftBar、Tailscale...) 在 ControlCenter
  log 里都是 `app<application.X.Y.Z>` 格式
- 失败的 (Snaky 任意 bundle id 任意签名) 都是 `anon<Snaky>(501):pid` 格式
- 触发 block 不需要任何代码缺陷——空白 30 行 NSStatusItem MVP 同样被 block

**正确启动路径:**
- 通过 `open /Applications/Snaky.app` (LaunchServices 走 application bootstrap)
- 或通过 Dock/Finder/Spotlight 双击启动
- **绝对不要直接 exec .app 内的二进制**,即使是为了拿 stderr——会污染 bundle id

**调试期间的正确做法:**
- 第一次怀疑某 bundle id 已被 block,用 `log show --predicate 'process == "ControlCenter"'`
  搜 `bid:<your-id>`,看有没有 `track blocked host`。
- 一旦 block,**只能换全新 bundle id**——重装/重签/重启都无效。
- 不要在终端 exec `.app/Contents/MacOS/Snaky` 看日志;改用 `open` 启动后 `log show`
  按进程名抓:`log show --predicate 'process == "Snaky"' --last 1m`。

**build.sh 已加 `lsregister -f` 步骤**,确保打完包先注册到 LaunchServices,
之后 `open` 启动就走 application 路径。

### 0a. 历史误判: 这不是"SystemUI cooldown"

v1.0.1 / v1.0.2 / v1.0.3 调试期间多次"换 bundle id 后缀"修复,本以为是
反复打包导致系统对 bundle id 冷却,实际全部是 anon-process block 反复触发。
每次"看着新 id 第一次有效"——其实 frame 数字误导,根本没渲染过。
真正的 fix 是改启动方式,不是改 id。

### 0b. variableLength 仍然是对的

v1.0.1 改 variableLength 修的是另一个问题 (Tahoe 上 squareLength 满载时 Y=-14),
跟本次 anon block 无关,保留。

### 1. `undici` 版本必须匹配 Node engines

`undici@8` 要求 **Node 23+**(`webidl.util.markAsUncloneable`)。本项目 `engines.node >= 20`,
所以 undici 锁在 `^7`(`7.26.x` 支持 Node 18+,提供同样的 `ProxyAgent`)。

升级 undici 之前先核对它的 `engines`,否则在 Node 20/22 上加载即 `TypeError`,
还会出现 **零 stderr、零 stdout、exit 1** 的诡异崩溃,极难定位。

### 2. CLI 入口必须挂全局错误 handler

`packages/cli/src/index.ts` 必须有 `uncaughtException` + `unhandledRejection` 监听,
把错误写到 stderr 再 `process.exit(1)`。否则模块加载期或 `main()` 内部任何
unhandled rejection 都可能让进程**静默退出 1、stderr 全空**——CI 失败时
没有任何线索可看,debug 成本极高(本次定位用了 1+ 小时)。

### 3. E2E 失败时把 child stderr/stdout 也吐出来

`tests/e2e/binary.test.ts` 的 `run()` helper 在 catch 分支 **只返回**
`{stdout, stderr}` 让断言访问。当 child process 崩溃时,默认错误信息只有
`expected 1 to be 0`——看不到子进程真实输出。debug CI 时,临时给 catch 分支
加一行 `if (process.env.CI) console.error(err.stderr, err.stdout)` 是定位
问题的关键工具。完事记得清掉。

### 4. CI 与本机环境差异不能靠"猜"

本次 14 个 e2e 在 CI 全挂,本地全过——花了大量时间猜 pnpm 版本/hoist 布局/Node 版本,
全是错的。**正确做法**:第一时间在 CI workflow 临时加诊断步骤(`node dist/index.js --version`、
`ls node_modules/undici`)+ 在 e2e 加 stderr dump,让 CI 自己报真相,再修。

### 5. `bump-version` 后跑 `pnpm install` 同步 lockfile

发布规范要求,但本次漏了。虽然这次 lockfile 已是新的,没造成问题——但严格按
规范执行可避免 CI `--frozen-lockfile` 因 lockfile 元数据漂移而失败。

