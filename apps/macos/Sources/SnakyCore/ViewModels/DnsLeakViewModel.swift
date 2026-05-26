import Foundation

@MainActor
public final class DnsLeakViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: ViewState = .idle

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
        currentTask = Task {
            do {
                let output = try await bridge.invokeDnsLeak(extended: extended)
                if !Task.isCancelled {
                    state = .success(output)
                }
            } catch let error as CLIError {
                if !Task.isCancelled {
                    state = .error(error)
                }
            } catch {
                if !Task.isCancelled {
                    state = .error(.fatal(error.localizedDescription))
                }
            }
        }
    }
}
