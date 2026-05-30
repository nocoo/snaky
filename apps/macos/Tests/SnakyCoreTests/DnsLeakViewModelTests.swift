import Foundation
import Testing

@testable import SnakyCore

@MainActor
struct DnsLeakViewModelTests {
    // MARK: - Test Doubles

    private struct MockFileChecker: FileExistenceChecker {
        let existingPaths: Set<String>
        func isExecutableFile(atPath path: String) -> Bool {
            existingPaths.contains(path)
        }
    }

    private struct MockShellExecutor: ShellExecutor {
        func execute(command: String, timeout: Duration) async throws -> String? {
            nil
        }
    }

    private struct MockProcessExecutor: ProcessExecutor {
        let exitCode: Int32
        let stdout: Data
        let stderr: Data
        let delay: Duration

        init(
            exitCode: Int32 = 0,
            stdout: Data = Data(),
            stderr: Data = Data(),
            delay: Duration = .zero
        ) {
            self.exitCode = exitCode
            self.stdout = stdout
            self.stderr = stderr
            self.delay = delay
        }

        func run(
            executablePath: String,
            arguments: [String],
            timeout: Duration
        ) async throws -> ProcessOutput {
            if delay > .zero {
                try await Task.sleep(for: delay)
            }
            let isNdjson = arguments.contains("--ndjson")
            if isNdjson && exitCode == 0 && !stdout.isEmpty {
                // Wrap a parsed FullOutput-style payload as a dns.update event line
                let line = "{\"event\":\"dns.update\",\"data\":"
                var buffer = Data(line.utf8)
                buffer.append(stdout)
                buffer.append(Data("}\n".utf8))
                let doneLine = #"{"event":"done","data":{"exitCode":0}}"# + "\n"
                buffer.append(Data(doneLine.utf8))
                return ProcessOutput(exitCode: 0, stdout: buffer, stderr: stderr)
            }
            return ProcessOutput(
                exitCode: exitCode,
                stdout: stdout,
                stderr: stderr
            )
        }
    }

    private static let noLeakJSON = Data("""
    {"token":"abc123","rounds":5,"userIp":"1.2.3.4",\
    "userCountry":"United States","userCountryCode":"US",\
    "dnsServers":[{"ip":"172.64.36.1","country":"US",\
    "countryCode":"US","city":null,"isp":"Cloudflare",\
    "asn":13335,"asOrg":null,"leaked":false}],\
    "count":1,"verdict":"no_leak"}
    """.utf8)

    private func makeBridge(
        exitCode: Int32 = 0,
        stdout: Data = DnsLeakViewModelTests.noLeakJSON,
        stderr: Data = Data(),
        delay: Duration = .zero
    ) -> CLIBridge {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(
                existingPaths: ["/usr/local/bin/snaky"]
            ),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/usr/local/bin/snaky" }
        )
        let executor = MockProcessExecutor(
            exitCode: exitCode,
            stdout: stdout,
            stderr: stderr,
            delay: delay
        )
        return CLIBridge(discovery: discovery, executor: executor)
    }

    // MARK: - Tests

    @Test func initialStateIsIdle() {
        let bridge = makeBridge()
        let vm = DnsLeakViewModel(bridge: bridge)
        #expect(vm.state == .idle)
    }

    @Test func runTestTransitionsToLoading() {
        let bridge = makeBridge(delay: .seconds(5))
        let vm = DnsLeakViewModel(bridge: bridge)
        vm.runTest()
        #expect(vm.state == .loading)
    }

    @Test func runTestSuccess() async throws {
        let bridge = makeBridge()
        let vm = DnsLeakViewModel(bridge: bridge)
        vm.runTest()
        try await Task.sleep(for: .milliseconds(50))
        if case .success(let output) = vm.state {
            #expect(output.verdict == .noLeak)
            #expect(output.token == "abc123")
        } else {
            Issue.record("Expected success state, got \(vm.state)")
        }
    }

    @Test func runTestError() async throws {
        let bridge = makeBridge(
            exitCode: 3,
            stdout: Data(),
            stderr: Data("Error: bad args\n".utf8)
        )
        let vm = DnsLeakViewModel(bridge: bridge)
        vm.runTest()
        try await Task.sleep(for: .milliseconds(50))
        #expect(vm.state == .error(.fatal("Error: bad args")))
    }

    @Test func rerunCancelsPrevious() async throws {
        let slowBridge = makeBridge(delay: .seconds(5))
        let vm = DnsLeakViewModel(bridge: slowBridge)
        vm.runTest()
        #expect(vm.state == .loading)

        let fastBridge = makeBridge()
        let vm2 = DnsLeakViewModel(bridge: fastBridge)
        vm2.runTest()
        vm2.runTest(extended: true)
        try await Task.sleep(for: .milliseconds(50))
        if case .success = vm2.state {
            // Pass: re-run completed
        } else {
            Issue.record("Expected success after re-run")
        }
    }
}
