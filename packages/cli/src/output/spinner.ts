const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export type Spinner = { update(msg: string): void; stop(): void };

export function startSpinner(message: string): Spinner {
  if (!process.stdout.isTTY) return { update() {}, stop() {} };
  let msg = message;
  let frame = 0;
  const timer = setInterval(() => {
    process.stdout.write(`\r\x1b[K\x1b[36m${FRAMES[frame % FRAMES.length]}\x1b[0m ${msg}`);
    frame++;
  }, 80);
  return {
    update(m) { msg = m; },
    stop() { clearInterval(timer); process.stdout.write("\r\x1b[K"); },
  };
}
