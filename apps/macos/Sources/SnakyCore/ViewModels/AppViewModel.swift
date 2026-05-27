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

    private static let enabledProbeTargetsKey = "enabledProbeTargets"
    private let maxHistoryDots = 30

    public enum ViewState: Equatable {
        case idle
        case loading
        case success(FullOutput)
        case error(CLIError)
    }

    private enum PartialResult: Sendable {
        case ping(Result<FullOutput, CLIError>)
        case probe(Result<FullOutput, CLIError>)
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
        currentTask = Task {
            if cliVersion == nil {
                cliVersion = await bridge.fetchVersion()
            }
            await fetchParallel()
        }
    }

    private func fetchParallel() async {
        await withTaskGroup(of: PartialResult.self) { group in
            group.addTask { await self.fetchPing() }
            group.addTask { await self.fetchProbe() }

            var ping: PingOutput?
            var probe: ProbeOutput?
            var ipDetails: [IpDetail]?
            var pingError: CLIError?
            var probeError: CLIError?

            for await partial in group {
                guard !Task.isCancelled else { return }
                switch partial {
                case .ping(.success(let output)):
                    ping = output.connect
                case .ping(.failure(let error)):
                    pingError = error
                case .probe(.success(let output)):
                    probe = output.split
                    ipDetails = output.ipDetails
                case .probe(.failure(let error)):
                    probeError = error
                }

                if ping != nil || probe != nil {
                    let merged = FullOutput(mode: .all, split: probe, connect: ping, dns: nil, ipDetails: ipDetails)
                    previousResult = merged
                    lastUpdated = Date()
                    state = .success(merged)
                }
            }

            guard !Task.isCancelled else { return }
            finalizeFetch(ping: ping, probe: probe, pingError: pingError, probeError: probeError)
        }
    }

    private func finalizeFetch(ping: PingOutput?, probe: ProbeOutput?, pingError: CLIError?, probeError: CLIError?) {
        if let results = ping?.results {
            appendPingHistory(results)
        }
        if ping == nil && probe == nil {
            let error = pingError ?? probeError ?? .timeout
            if error == .timeout { statusMessage = "Timed out" }
            state = .error(error)
        }
    }

    private nonisolated func fetchPing() async -> PartialResult {
        do {
            return .ping(.success(try await bridge.invoke(mode: "connect")))
        } catch let error as CLIError {
            return .ping(.failure(error))
        } catch {
            return .ping(.failure(.timeout))
        }
    }

    private nonisolated func fetchProbe() async -> PartialResult {
        do {
            return .probe(.success(try await bridge.invoke(mode: "split", tier: 2)))
        } catch let error as CLIError {
            return .probe(.failure(error))
        } catch {
            return .probe(.failure(.timeout))
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
