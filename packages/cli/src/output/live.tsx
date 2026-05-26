import { Box, Text, render } from "ink";
import React, { useState } from "react";
import type { PingResult } from "../runner/ping-runner.js";
import type { ProbeEntry } from "./types.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

type ProbeSlot = { status: "pending" | "done"; entry?: ProbeEntry };
type PingSlot = { status: "pending" | "done"; result?: PingResult };

type AppProps = {
  probeNames: string[];
  pingNames: string[];
  onReady: (callbacks: LiveCallbacks) => void;
};

export type LiveCallbacks = {
  setProbeResult: (index: number, entry: ProbeEntry) => void;
  setPingResult: (index: number, result: PingResult) => void;
  setPingResults: (results: PingResult[]) => void;
  setComplete: () => void;
};

function Spinner(): React.ReactElement {
  const [frame, setFrame] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);
  return <Text color="cyan">{SPINNER_FRAMES[frame]}</Text>;
}

function ProbeRow({ slot }: { slot: ProbeSlot }): React.ReactElement {
  if (slot.status === "pending") {
    return (
      <Box>
        <Spinner /><Text> {slot.entry?.name ?? "..."}</Text>
      </Box>
    );
  }
  const entry = slot.entry!;
  if (entry.ok) {
    const latStr = `${entry.responseTimeMs}ms`;
    return (
      <Text>
        <Text color="green">✓</Text> {entry.name.padEnd(18)}{" "}
        {(entry.location ?? "—").padEnd(8)}{" "}
        {(entry.colo ?? "—").padEnd(5)}{" "}
        <Text color={latencyColor(entry.responseTimeMs)}>{latStr.padStart(7)}</Text>
        {"  "}{entry.ip}
      </Text>
    );
  }
  return (
    <Text>
      <Text color="red">✗</Text> {entry.name.padEnd(18)}{" "}
      {"—".padEnd(8)} {"—".padEnd(5)}{" "}
      <Text color="red">{"UNKNOWN".padStart(7)}</Text>
    </Text>
  );
}

function PingRow({ slot }: { slot: PingSlot }): React.ReactElement {
  if (slot.status === "pending") {
    return (
      <Box>
        <Spinner /><Text> {slot.result?.name ?? "..."}</Text>
      </Box>
    );
  }
  const r = slot.result!;
  if (r.ok) {
    const latStr = `${r.medianMs}ms`;
    return (
      <Text>
        <Text color="green">✓</Text> {r.name.padEnd(18)}{" "}
        {r.tag.padEnd(14)}{" "}
        <Text color={latencyColor(r.medianMs ?? 0)}>{latStr.padStart(7)}</Text>
      </Text>
    );
  }
  return (
    <Text>
      <Text color="red">✗</Text> {r.name.padEnd(18)}{" "}
      {r.tag.padEnd(14)}{" "}
      <Text color="red">{"FAILED".padStart(7)}</Text>
    </Text>
  );
}

function App({ probeNames, pingNames, onReady }: AppProps): React.ReactElement {
  const [probes, setProbes] = useState<ProbeSlot[]>(
    probeNames.map((name) => ({
      status: "pending",
      entry: { name } as unknown as ProbeEntry,
    })),
  );
  const [pings, setPings] = useState<PingSlot[]>(
    pingNames.map((name) => ({
      status: "pending",
      result: { name } as unknown as PingResult,
    })),
  );

  React.useEffect(() => {
    onReady({
      setProbeResult(index, entry) {
        setProbes((prev) => {
          const next = [...prev];
          next[index] = { status: "done", entry };
          return next;
        });
      },
      setPingResult(index, result) {
        setPings((prev) => {
          const next = [...prev];
          next[index] = { status: "done", result };
          return next;
        });
      },
      setPingResults(results) {
        setPings(results.map((r) => ({ status: "done", result: r })));
      },
      setComplete() {
        // no-op, kept for interface compatibility
      },
    });
  }, [onReady]);

  return (
    <Box flexDirection="column">
      {pingNames.length > 0 && (
        <Box flexDirection="column">
          <Text bold>🏓 Connectivity Test</Text>
          {pings.map((slot, i) => (
            <PingRow key={pingNames[i]} slot={slot} />
          ))}
        </Box>
      )}
      {probeNames.length > 0 && (
        <Box flexDirection="column">
          <Text>{""}</Text>
          <Text bold>🔀 Split Tunnel Probe</Text>
          {probes.map((slot, i) => (
            <ProbeRow key={probeNames[i]} slot={slot} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function latencyColor(ms: number): "green" | "yellow" | "red" {
  if (ms <= 200) return "green";
  if (ms <= 1000) return "yellow";
  return "red";
}

export type LiveRenderer = {
  callbacks: Promise<LiveCallbacks>;
  unmount: () => void;
};

export function startLiveRenderer(
  probeNames: string[],
  pingNames: string[],
): LiveRenderer {
  let resolveCallbacks: (cbs: LiveCallbacks) => void;
  const callbacks = new Promise<LiveCallbacks>((resolve) => {
    resolveCallbacks = resolve;
  });

  const { unmount } = render(
    <App
      probeNames={probeNames}
      pingNames={pingNames}
      onReady={(cbs) => resolveCallbacks(cbs)}
    />,
  );

  return { callbacks, unmount };
}
