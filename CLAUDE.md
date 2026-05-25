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
