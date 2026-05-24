export type PingOpts = {
  timeout: number;
};

export async function probeHttpPing(
  url: string,
  opts: PingOpts,
): Promise<number> {
  const start = performance.now();
  try {
    await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeout),
    });
    return Math.round(performance.now() - start);
  } catch {
    return -1;
  }
}
