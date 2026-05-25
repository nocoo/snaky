import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Secrets = {
  echoApiKey?: string;
};

const DEFAULT_SECRETS_PATH = join(homedir(), ".snaky");

export function loadSecrets(path?: string): Secrets {
  const filePath = path ?? DEFAULT_SECRETS_PATH;
  if (!existsSync(filePath)) return {};

  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      echoApiKey: typeof parsed.echoApiKey === "string" ? parsed.echoApiKey : undefined,
    };
  } catch {
    return {};
  }
}
