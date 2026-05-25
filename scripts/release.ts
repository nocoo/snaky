import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const CLI_DIR = resolve(ROOT, "packages/cli");
const rootPkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf-8"));
const version = rootPkg.version;

function run(cmd: string, cwd = ROOT) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

console.log(`\nReleasing v${version}\n`);

run("pnpm build");
run("pnpm test");
run("pnpm test:e2e");

run(`git add -A`);
run(`git commit --allow-empty -m "release: v${version}"`);
run(`git tag v${version}`);

run("npm publish --access public", CLI_DIR);

console.log(`\nPublished @nocoo/snaky@${version}`);
console.log("Run 'git push && git push --tags' to push the release.");
