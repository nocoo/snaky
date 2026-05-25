import Foundation
import Testing

@testable import SnakyCore

@MainActor
struct ErrorStateTests {
    private static func makeOutput() -> FullOutput {
        FullOutput(
            mode: .all,
            probe: ProbeOutput(
                results: [
                    ProbeEntry(
                        name: "test",
                        category: "ai",
                        method: .cftrace,
                        target: "test.com",
                        resolvedTarget: nil,
                        ok: true,
                        ip: "1.2.3.4",
                        location: "JP",
                        colo: "NRT",
                        responseTimeMs: 100,
                        usedFallback: false,
                        error: nil
                    )
                ],
                summary: ProbeSummary(total: 1, succeeded: 1, failed: 0),
                uniqueIps: [UniqueIp(ip: "1.2.3.4", location: "JP", count: 1)]
            ),
            ping: PingOutput(results: [])
        )
    }

    private static func makeBridge(
        result: Result<FullOutput, CLIError>
    ) -> CLIBridge {
        let discovery = CLIDiscovery(
            fileChecker: FakeFileChecker(existingPaths: ["/usr/local/bin/snaky"]),
            shellExecutor: FakeShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = FakeProcessExecutor(result: result)
        return CLIBridge(discovery: discovery, executor: executor)
    }

    private static func makeNotFoundBridge() -> CLIBridge {
        let discovery = CLIDiscovery(
            fileChecker: FakeFileChecker(existingPaths: []),
            shellExecutor: FakeShellExecutor(),
            configuredPath: { nil }
        )
        return CLIBridge(discovery: discovery, executor: FakeProcessExecutor(result: .failure(.notFound)))
    }

    @Test func notFoundShowsSetupState() async throws {
        let bridge = Self.makeNotFoundBridge()
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.notFound))
    }

    @Test func timeoutShowsError() async throws {
        let bridge = Self.makeBridge(result: .failure(.timeout))
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.timeout))
    }

    @Test func crashedShowsError() async throws {
        let bridge = Self.makeBridge(result: .failure(.crashed(139)))
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.crashed(139)))
    }

    @Test func fatalShowsStderrMessage() async throws {
        let bridge = Self.makeBridge(result: .failure(.fatal("Config invalid")))
        let vm = AppViewModel(bridge: bridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.fatal("Config invalid")))
    }

    @Test func previousResultsPreservedOnError() async throws {
        let output = Self.makeOutput()
        let successBridge = Self.makeBridge(result: .success(output))
        let vm = AppViewModel(bridge: successBridge)
        vm.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .success(output))
        #expect(vm.previousResult == output)

        let failBridge = Self.makeBridge(result: .failure(.timeout))
        let vm2 = AppViewModel(bridge: failBridge)
        vm2.previousResult = output
        vm2.refresh()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm2.state == .error(.timeout))
        #expect(vm2.previousResult == output)
    }
}

// MARK: - Shared fakes

private struct FakeFileChecker: FileExistenceChecker {
    let existingPaths: Set<String>
    func fileExists(atPath path: String) -> Bool { existingPaths.contains(path) }
}

private struct FakeShellExecutor: ShellExecutor {
    func execute(command: String, timeout: Duration) async throws -> String? { nil }
}

private final class FakeProcessExecutor: ProcessExecutor, @unchecked Sendable {
    private let result: Result<FullOutput, CLIError>

    init(result: Result<FullOutput, CLIError>) {
        self.result = result
    }

    func run(executablePath: String, arguments: [String], timeout: Duration) async throws -> ProcessOutput {
        switch result {
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
