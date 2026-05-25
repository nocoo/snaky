import Foundation
import Testing

@testable import SnakyCore

struct CLIBridgeTests {
    // MARK: - Test Doubles

    private struct MockProcessExecutor: ProcessExecutor {
        let output: ProcessOutput?
        let shouldTimeout: Bool

        init(exitCode: Int32 = 0, stdout: Data = Data(), stderr: Data = Data(), shouldTimeout: Bool = false) {
            if shouldTimeout {
                self.output = nil
                self.shouldTimeout = true
            } else {
                self.output = ProcessOutput(exitCode: exitCode, stdout: stdout, stderr: stderr)
                self.shouldTimeout = false
            }
        }

        func run(executablePath: String, arguments: [String], timeout: Duration) async throws -> ProcessOutput {
            if shouldTimeout { throw CLIError.timeout }
            guard let output else { throw CLIError.timeout }
            return output
        }
    }

    private static let validJSON: Data = {
        let json = """
        {
          "mode": "all",
          "probe": {
            "results": [],
            "summary": { "total": 0, "succeeded": 0, "failed": 0 },
            "uniqueIps": []
          },
          "ping": { "results": [] }
        }
        """
        return Data(json.utf8)
    }()

    private func makeBridge(
        exitCode: Int32 = 0,
        stdout: Data = CLIBridgeTests.validJSON,
        stderr: Data = Data(),
        shouldTimeout: Bool = false
    ) -> CLIBridge {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/usr/local/bin/snaky"]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = MockProcessExecutor(
            exitCode: exitCode,
            stdout: stdout,
            stderr: stderr,
            shouldTimeout: shouldTimeout
        )
        return CLIBridge(discovery: discovery, executor: executor)
    }

    // MARK: - Discovery mocks (reused from CLIDiscoveryTests)

    private struct MockFileChecker: FileExistenceChecker {
        let existingPaths: Set<String>
        func fileExists(atPath path: String) -> Bool { existingPaths.contains(path) }
    }

    private struct MockShellExecutor: ShellExecutor {
        func execute(command: String, timeout: Duration) async throws -> String? { nil }
    }

    // MARK: - Tests

    @Test func bridgeExitCode0() async throws {
        let bridge = makeBridge(exitCode: 0)
        let result = try await bridge.invoke()
        #expect(result.mode == .all)
        #expect(result.probe != nil)
        #expect(result.ping != nil)
    }

    @Test func bridgeExitCode1() async throws {
        let bridge = makeBridge(exitCode: 1)
        let result = try await bridge.invoke()
        #expect(result.mode == .all)
    }

    @Test func bridgeExitCode2() async throws {
        let bridge = makeBridge(exitCode: 2)
        let result = try await bridge.invoke()
        #expect(result.mode == .all)
    }

    @Test func bridgeExitCode3() async throws {
        let stderrMsg = "Error: Config file is not valid JSON"
        let bridge = makeBridge(exitCode: 3, stdout: Data(), stderr: Data(stderrMsg.utf8))
        do {
            _ = try await bridge.invoke()
            Issue.record("Expected CLIError.fatal")
        } catch let error as CLIError {
            #expect(error == .fatal(stderrMsg))
        }
    }

    @Test func bridgeTimeout() async throws {
        let bridge = makeBridge(shouldTimeout: true)
        do {
            _ = try await bridge.invoke()
            Issue.record("Expected CLIError.timeout")
        } catch let error as CLIError {
            #expect(error == .timeout)
        }
    }

    @Test func bridgeCrash() async throws {
        let bridge = makeBridge(exitCode: 139)
        do {
            _ = try await bridge.invoke()
            Issue.record("Expected CLIError.crashed")
        } catch let error as CLIError {
            #expect(error == .crashed(139))
        }
    }

    @Test func bridgeMalformedJSON() async throws {
        let bridge = makeBridge(exitCode: 0, stdout: Data("not json".utf8))
        do {
            _ = try await bridge.invoke()
            Issue.record("Expected CLIError.decodingFailed")
        } catch let error as CLIError {
            guard case .decodingFailed = error else {
                Issue.record("Expected .decodingFailed, got \(error)")
                return
            }
        }
    }

    @Test func bridgeNotFound() async throws {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: []),
            shellExecutor: MockShellExecutor(),
            configuredPath: { nil }
        )
        let bridge = CLIBridge(discovery: discovery, executor: MockProcessExecutor())
        do {
            _ = try await bridge.invoke()
            Issue.record("Expected CLIError.notFound")
        } catch let error as CLIError {
            #expect(error == .notFound)
        }
    }

    @Test func cancelKillsProcess() async throws {
        let executor = DefaultProcessExecutor()
        let task = Task {
            try await executor.run(
                executablePath: "/bin/sleep",
                arguments: ["60"],
                timeout: .seconds(90)
            )
        }

        try await Task.sleep(for: .milliseconds(200))
        task.cancel()

        let start = ContinuousClock.now
        let result = await task.result
        let elapsed = ContinuousClock.now - start

        #expect(elapsed < .seconds(5))
        switch result {
        case .success(let output):
            #expect(output.exitCode != 0)
        case .failure:
            break
        }
    }

    @Test func fetchVersionSuccess() async throws {
        let versionData = Data("1.2.3\n".utf8)
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/usr/local/bin/snaky"]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = MockProcessExecutor(exitCode: 0, stdout: versionData)
        let bridge = CLIBridge(discovery: discovery, executor: executor)
        let version = await bridge.fetchVersion()
        #expect(version == "1.2.3")
    }

    @Test func fetchVersionNotFound() async throws {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: []),
            shellExecutor: MockShellExecutor(),
            configuredPath: { nil }
        )
        let bridge = CLIBridge(discovery: discovery, executor: MockProcessExecutor())
        let version = await bridge.fetchVersion()
        #expect(version == nil)
    }
}
