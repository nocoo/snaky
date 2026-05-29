import { describe, expect, it } from "vitest";
import { createNdjsonWriter, type NdjsonEvent } from "./ndjson.js";

describe("createNdjsonWriter", () => {
  it("emits one JSON event per line", () => {
    const chunks: string[] = [];
    const stream = {
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
    } as NodeJS.WritableStream;

    const writer = createNdjsonWriter(stream);
    writer.emit({ event: "meta", data: { mode: "split", version: "1.0.0", counts: { split: 2 } } });
    writer.emit({ event: "done", data: { exitCode: 0 } });

    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.endsWith("\n")).toBe(true);
    expect(chunks[1]?.endsWith("\n")).toBe(true);

    const first = JSON.parse(chunks[0] as string) as NdjsonEvent;
    expect(first.event).toBe("meta");
  });

  it("preserves field order with no extra whitespace", () => {
    const chunks: string[] = [];
    const stream = {
      write(chunk: string) {
        chunks.push(chunk);
        return true;
      },
    } as NodeJS.WritableStream;

    const writer = createNdjsonWriter(stream);
    writer.emit({
      event: "probe.result",
      data: {
        index: 0,
        name: "test",
        category: "ai",
        method: "cftrace",
        target: "x.com",
        usedFallback: false,
        ok: true,
        ip: "1.2.3.4",
        location: "US",
        colo: "LAX",
        responseTimeMs: 100,
      },
    });

    expect(chunks[0]).not.toContain("\n  ");
    expect(chunks[0]?.endsWith("}\n")).toBe(true);
  });
});
