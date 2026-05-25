import AppKit
import Foundation

@MainActor
public final class AppViewModel: ObservableObject {
    private let bridge: CLIBridge

    @Published public private(set) var state: ViewState = .idle
    @Published public var previousResult: FullOutput?
    @Published public private(set) var cliVersion: String?

    public enum ViewState: Equatable {
        case idle
        case loading
        case success(FullOutput)
        case error(CLIError)
    }

    private var currentTask: Task<Void, Never>?

    public init(bridge: CLIBridge) {
        self.bridge = bridge
    }

    public func refresh() {
        currentTask?.cancel()
        state = .loading
        currentTask = Task {
            if cliVersion == nil {
                cliVersion = await bridge.fetchVersion()
            }
            do {
                let output = try await bridge.invoke()
                guard !Task.isCancelled else { return }
                previousResult = output
                state = .success(output)
            } catch let error as CLIError {
                guard !Task.isCancelled else { return }
                state = .error(error)
            } catch {
                guard !Task.isCancelled else { return }
                state = .error(.timeout)
            }
        }
    }

    public func cancel() {
        currentTask?.cancel()
        currentTask = nil
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
