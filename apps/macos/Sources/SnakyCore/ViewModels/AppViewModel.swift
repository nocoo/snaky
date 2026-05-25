import Foundation

@MainActor
public final class AppViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: ViewState = .idle

    public enum ViewState: Equatable {
        case idle
        case loading
        case success(FullOutput)
        case error(CLIError)
    }

    public init(bridge: CLIBridge) {
        self.bridge = bridge
    }

    public func refresh() {
    }

    public func cancel() {
    }
}
