import type { FullOutput } from "./types.js";

export function formatJson(output: FullOutput): string {
  return JSON.stringify(output, null, 2);
}
