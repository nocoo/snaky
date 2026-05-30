import Foundation

public enum DnsLeakProgressPhase: Sendable {
    case fetchingIp
    case sendingQueries
    case collecting
    case enriching
    case other
}

public struct DnsLeakProgress: Equatable, Sendable {
    public let phase: DnsLeakProgressPhase
    public let currentRound: Int?
    public let totalRounds: Int?
    public let message: String
}

@MainActor
public final class DnsLeakViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: ViewState = .idle
    @Published public private(set) var progress: DnsLeakProgress?

    public enum ViewState: Equatable {
        case idle
        case loading
        case success(DnsLeakOutput)
        case error(CLIError)
    }

    private var currentTask: Task<Void, Never>?

    public init(bridge: CLIBridge) {
        self.bridge = bridge
    }

    public func runTest(extended: Bool = false) {
        currentTask?.cancel()
        state = .loading
        progress = DnsLeakProgress(
            phase: .other,
            currentRound: nil,
            totalRounds: extended ? 8 : 5,
            message: "Starting..."
        )
        currentTask = Task {
            do {
                let stream = try await bridge.streamDnsLeak(extended: extended)
                for try await event in stream {
                    if Task.isCancelled { return }
                    handle(event: event)
                }
            } catch let error as CLIError {
                if !Task.isCancelled {
                    state = .error(error)
                    progress = nil
                }
            } catch {
                if !Task.isCancelled {
                    state = .error(.fatal(error.localizedDescription))
                    progress = nil
                }
            }
        }
    }

    private func handle(event: NdjsonEvent) {
        switch event {
        case .dnsProgress(let message):
            progress = parse(message: message, fallback: progress)
        case .dnsUpdate(let output):
            state = .success(output)
            progress = nil
        case .errorEvent(_, let message):
            state = .error(.fatal(message))
            progress = nil
        case .meta, .done, .probeResult, .pingResult, .ipDetail, .uniqueIp, .summary, .unknown:
            break
        }
    }

    private func parse(message: String, fallback: DnsLeakProgress?) -> DnsLeakProgress {
        let totalFallback = fallback?.totalRounds
        if message.hasPrefix("Fetching your IP") {
            return DnsLeakProgress(phase: .fetchingIp, currentRound: nil, totalRounds: totalFallback, message: message)
        }
        if message.hasPrefix("Sending DNS queries") {
            if let range = message.range(of: #"\((\d+)/(\d+)\)"#, options: .regularExpression) {
                let inner = message[range].dropFirst().dropLast()
                let parts = inner.split(separator: "/")
                if parts.count == 2,
                   let cur = Int(parts[0]),
                   let tot = Int(parts[1]) {
                    return DnsLeakProgress(
                        phase: .sendingQueries,
                        currentRound: cur,
                        totalRounds: tot,
                        message: message
                    )
                }
            }
            return DnsLeakProgress(
                phase: .sendingQueries,
                currentRound: nil,
                totalRounds: totalFallback,
                message: message
            )
        }
        if message.hasPrefix("Collecting") {
            return DnsLeakProgress(phase: .collecting, currentRound: nil, totalRounds: totalFallback, message: message)
        }
        if message.hasPrefix("Enriching") {
            return DnsLeakProgress(phase: .enriching, currentRound: nil, totalRounds: totalFallback, message: message)
        }
        return DnsLeakProgress(phase: .other, currentRound: nil, totalRounds: totalFallback, message: message)
    }
}
