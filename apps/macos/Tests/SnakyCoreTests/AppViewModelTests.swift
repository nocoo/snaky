import Foundation
import Testing

@testable import SnakyCore

@MainActor
struct AppViewModelTests {
    // MARK: - Test Doubles

    fileprivate final class MockBridge: @unchecked Sendable {
        var result: Result<FullOutput, CLIError> = .failure(.notFound)
        var delay: Duration = .zero
        var invokeCount = 0
    }

    private static func makeOutput(mode: RunMode = .all) -> FullOutput {
        FullOutput(
            mode: mode,
            probe: ProbeOutput(
                results: [],
                summary: ProbeSummary(total: 0, succeeded: 0, failed: 0),
                uniqueIps: []
            ),
            ping: PingOutput(results: [])
        )
    }

    private static func makeBridge(
        result: Result<FullOutput, CLIError> = .success(makeOutput()),
        delay: Duration = .zero
    ) -> (CLIBridge, MockBridge) {
        let mock = MockBridge()
        mock.result = result
        mock.delay = delay
        let discovery = CLIDiscovery(
            fileChecker: TestFileChecker(existingPaths: ["/usr/local/bin/snaky"]),
            shellExecutor: TestShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = TestProcessExecutor(mock: mock)
        let bridge = CLIBridge(discovery: discovery, executor: executor)
        return (bridge, mock)
    }

    // MARK: - Tests

    @Test func initialStateIsIdle() {
        let (bridge, _) = Self.makeBridge()
        let vm = AppViewModel(bridge: bridge)
        #expect(vm.state == .idle)
        #expect(vm.previousResult == nil)
    }

    @Test func refreshSuccess() async throws {
        let output = Self.makeOutput()
        let (bridge, _) = Self.makeBridge(result: .success(output))
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        #expect(vm.state == .loading)
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .success(output))
        #expect(vm.previousResult == output)
    }

    @Test func refreshFailure() async throws {
        let (bridge, _) = Self.makeBridge(result: .failure(.timeout))
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.timeout))
    }

    @Test func cancelDuringRefresh() async throws {
        let (bridge, _) = Self.makeBridge(
            result: .success(Self.makeOutput()),
            delay: .seconds(5)
        )
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        #expect(vm.state == .loading)
        vm.cancel()
        #expect(vm.state == .idle)
    }

    @Test func cancelPreservesPreviousResult() async throws {
        let output = Self.makeOutput()
        let (bridge, _) = Self.makeBridge(result: .success(output))
        let vm = AppViewModel(bridge: bridge)

        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .success(output))

        let (slowBridge, _) = Self.makeBridge(result: .success(output), delay: .seconds(5))
        let vm2 = AppViewModel(bridge: slowBridge)
        vm2.previousResult = output
        vm2.refresh()
        vm2.cancel()
        #expect(vm2.state == .success(output))
    }

    @Test func refreshAfterSuccess() async throws {
        let output1 = Self.makeOutput(mode: .all)
        let output2 = Self.makeOutput(mode: .probe)
        let (bridge1, _) = Self.makeBridge(result: .success(output1))
        let vm = AppViewModel(bridge: bridge1)

        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .success(output1))

        let (bridge2, _) = Self.makeBridge(result: .success(output2))
        let vm2 = AppViewModel(bridge: bridge2)
        vm2.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm2.state == .success(output2))
    }

    @Test func refreshAfterError() async throws {
        let (bridge1, _) = Self.makeBridge(result: .failure(.notFound))
        let vm = AppViewModel(bridge: bridge1)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.notFound))

        let output = Self.makeOutput()
        let (bridge2, _) = Self.makeBridge(result: .success(output))
        let vm2 = AppViewModel(bridge: bridge2)
        vm2.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm2.state == .success(output))
    }
}

// MARK: - Test Helpers (shared)

private struct TestFileChecker: FileExistenceChecker {
    let existingPaths: Set<String>
    func fileExists(atPath path: String) -> Bool { existingPaths.contains(path) }
}

private struct TestShellExecutor: ShellExecutor {
    func execute(command: String, timeout: Duration) async throws -> String? { nil }
}

private final class TestProcessExecutor: ProcessExecutor, @unchecked Sendable {
    private let mock: AppViewModelTests.MockBridge

    init(mock: AppViewModelTests.MockBridge) {
        self.mock = mock
    }

    func run(executablePath: String, arguments: [String], timeout: Duration) async throws -> ProcessOutput {
        mock.invokeCount += 1
        if mock.delay > .zero {
            try await Task.sleep(for: mock.delay)
        }
        switch mock.result {
        case .success(let output):
            let data = try JSONEncoder().encode(output)
            return ProcessOutput(exitCode: 0, stdout: data, stderr: Data())
        case .failure(let error):
            switch error {
            case .timeout:
                throw CLIError.timeout
            case .notFound:
                throw CLIError.notFound
            case .fatal(let msg):
                return ProcessOutput(exitCode: 3, stdout: Data(), stderr: Data(msg.utf8))
            case .crashed(let code):
                return ProcessOutput(exitCode: code, stdout: Data(), stderr: Data())
            case .decodingFailed:
                return ProcessOutput(exitCode: 0, stdout: Data("bad".utf8), stderr: Data())
            }
        }
    }
}
