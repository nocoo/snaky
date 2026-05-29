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

