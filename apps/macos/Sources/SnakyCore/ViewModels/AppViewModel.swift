import AppKit
import Foundation

@MainActor
public final class AppViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: ViewState = .idle
    @Published public var previousResult: FullOutput?
    @Published public private(set) var cliVersion: String?
    @Published public private(set) var lastUpdated: Date?
    @Published public private(set) var statusMessage: String?
    @Published public private(set) var pingHistory: [String: [PingRoundDot]] = [:]
    @Published public var enabledProbeTargets: Set<String>

    // Streaming state — populated incrementally as NDJSON events arrive
    @Published public private(set) var streamingEntries: [String: ProbeEntry] = [:]
    @Published public private(set) var streamingPing: [String: PingResult] = [:]
    @Published public private(set) var streamingPingOrder: [String] = []
    @Published public private(set) var streamingUniqueIps: [UniqueIp] = []
    @Published public private(set) var probesInFlight: Bool = false
    @Published public private(set) var pingInFlight: Bool = false

    private static let enabledProbeTargetsKey = "enabledProbeTargets"
    private let maxHistoryDots = 30

    public enum ViewState: Equatable {
        case idle
        case loading
        case success(FullOutput)
        case error(CLIError)
    }

    private var currentTask: Task<Void, Never>?

    public init(bridge: CLIBridge) {
        self.bridge = bridge
        if let saved = UserDefaults.standard.stringArray(forKey: Self.enabledProbeTargetsKey) {
            self.enabledProbeTargets = Set(saved)
        } else {
            self.enabledProbeTargets = ProbeTargetRegistry.tier1Names
        }
    }

    public func toggleProbeTarget(_ name: String) {
        if enabledProbeTargets.contains(name) {
            enabledProbeTargets.remove(name)
        } else {
            enabledProbeTargets.insert(name)
        }
        UserDefaults.standard.set(Array(enabledProbeTargets), forKey: Self.enabledProbeTargetsKey)
    }

    public func refresh() {
        currentTask?.cancel()
        state = .loading
        statusMessage = nil
        streamingEntries.removeAll()
        streamingPing.removeAll()
        streamingPingOrder.removeAll()
        streamingUniqueIps.removeAll()
        probesInFlight = true
        pingInFlight = true
        currentTask = Task {
            if cliVersion == nil {
                cliVersion = await bridge.fetchVersion()
            }
            await fetchStreaming()
        }
    }

    private func fetchStreaming() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.streamProbes() }
            group.addTask { await self.streamPing() }
        }
        guard !Task.isCancelled else { return }
        // Compose final FullOutput from streaming state if not already set by summary
        commitFinalIfNeeded()
    }

    private nonisolated func streamProbes() async {
        do {
            let stream = try await bridge.streamRun(mode: "split", tier: 2)
            for try await event in stream {
                if Task.isCancelled { return }
                await handle(event: event, kind: .probe)
            }
            await MainActor.run { self.probesInFlight = false }
        } catch let error as CLIError {
            await MainActor.run {
                self.probesInFlight = false
                if case .success = self.state { return }
                if self.streamingEntries.isEmpty && self.streamingPing.isEmpty {
                    self.state = .error(error)
                }
            }
        } catch {
            await MainActor.run {
                self.probesInFlight = false
                if self.streamingEntries.isEmpty && self.streamingPing.isEmpty {
                    self.state = .error(.fatal(error.localizedDescription))
                }
            }
        }
    }

    private nonisolated func streamPing() async {
        do {
            let stream = try await bridge.streamRun(mode: "connect")
            for try await event in stream {
                if Task.isCancelled { return }
                await handle(event: event, kind: .ping)
            }
            await MainActor.run { self.pingInFlight = false }
        } catch let error as CLIError {
            await MainActor.run {
                self.pingInFlight = false
                if case .success = self.state { return }
                if self.streamingEntries.isEmpty && self.streamingPing.isEmpty {
                    self.state = .error(error)
                }
            }
        } catch {
            await MainActor.run {
                self.pingInFlight = false
                if self.streamingEntries.isEmpty && self.streamingPing.isEmpty {
                    self.state = .error(.fatal(error.localizedDescription))
                }
            }
        }
    }

    private enum StreamKind { case probe, ping }

    @MainActor
    private func handle(event: NdjsonEvent, kind: StreamKind) {
        switch event {
        case .probeResult(_, let entry):
            streamingEntries[entry.name] = entry
            publishLive()
        case .pingResult(_, let result):
            if streamingPing[result.name] == nil {
                streamingPingOrder.append(result.name)
            }
            streamingPing[result.name] = result
            appendPingHistory([result])
            publishLive()
        case .uniqueIp(let unique):
            if !streamingUniqueIps.contains(where: { $0.ip == unique.ip }) {
                streamingUniqueIps.append(unique)
            }
            publishLive()
        case .ipDetail:
            // Detail attached to uniqueIp.detail by CLI before unique.ip event
            break
        case .summary(let full):
            // Authoritative final state
            previousResult = full
            lastUpdated = Date()
            state = .success(full)
        case .meta, .dnsProgress, .dnsUpdate, .errorEvent, .done, .unknown:
            break
        }
        _ = kind  // reserved if we want to differentiate later
    }

    private func publishLive() {
        let probeEntries = Array(streamingEntries.values)
        let pingResults = streamingPingOrder.compactMap { streamingPing[$0] }
        let probe = probeEntries.isEmpty ? nil : ProbeOutput(
            results: probeEntries,
            summary: ProbeSummary(
                total: probeEntries.count,
                succeeded: probeEntries.filter { $0.ok }.count,
                failed: probeEntries.filter { !$0.ok }.count
            ),
            uniqueIps: streamingUniqueIps
        )
        let ping = pingResults.isEmpty ? nil : PingOutput(results: pingResults)
        let merged = FullOutput(mode: .all, split: probe, connect: ping, dns: nil, ipDetails: nil)
        previousResult = merged
        lastUpdated = Date()
        state = .success(merged)
    }

    private func commitFinalIfNeeded() {
        if case .loading = state {
            publishLive()
        }
    }

    private func appendPingHistory(_ results: [PingResult]) {
        for result in results {
            let dots = result.rounds.map { PingRoundDot(isSuccess: $0 >= 0, ms: $0) }
            var existing = pingHistory[result.name, default: []]
            existing.append(contentsOf: dots)
            if existing.count > maxHistoryDots {
                existing = Array(existing.suffix(maxHistoryDots))
            }
            pingHistory[result.name] = existing
        }
    }

    public func cancel() {
        currentTask?.cancel()
        currentTask = nil
        probesInFlight = false
        pingInFlight = false
        statusMessage = "Refresh cancelled"
        if let previous = previousResult {
            state = .success(previous)
        } else {
            state = .idle
        }
    }

    public func selectCLIPath() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = false
        panel.message = "Select the snaky binary"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        let path = url.path
        guard FileManager.default.isExecutableFile(atPath: path) else { return }
        UserDefaults.standard.set(path, forKey: "cliPath")
        refresh()
    }
}
