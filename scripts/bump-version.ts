import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const rootPkg = resolve(ROOT, "package.json");
const cliPkg = resolve(ROOT, "packages/cli/package.json");

const bump = process.argv[2] as "patch" | "minor" | "major" | undefined;
if (!bump || !["patch", "minor", "major"].includes(bump)) {
  console.error("Usage: bun scripts/bump-version.ts <patch|minor|major>");
  process.exit(1);
}

const root = JSON.parse(readFileSync(rootPkg, "utf-8"));
const [major, minor, patch] = root.version.split(".").map(Number);

let newVersion: string;
if (bump === "major") newVersion = `${major + 1}.0.0`;
else if (bump === "minor") newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

root.version = newVersion;
writeFileSync(rootPkg, `${JSON.stringify(root, null, 2)}\n`);

const cli = JSON.parse(readFileSync(cliPkg, "utf-8"));
cli.version = newVersion;
writeFileSync(cliPkg, `${JSON.stringify(cli, null, 2)}\n`);

console.log(`Bumped version: ${root.version.replace(newVersion, `${major}.${minor}.${patch}`)} → ${newVersion}`);
