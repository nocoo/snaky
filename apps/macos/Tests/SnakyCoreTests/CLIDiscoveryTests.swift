import Foundation
import Testing

@testable import SnakyCore

struct CLIDiscoveryTests {
    // MARK: - Test Doubles

    struct MockFileChecker: FileExistenceChecker {
        let existingPaths: Set<String>
        func fileExists(atPath path: String) -> Bool { existingPaths.contains(path) }
    }

    struct MockShellExecutor: ShellExecutor {
        let result: String?
        let shouldTimeout: Bool

        init(result: String? = nil, shouldTimeout: Bool = false) {
            self.result = result
            self.shouldTimeout = shouldTimeout
        }

        func execute(command: String, timeout: Duration) async throws -> String? {
            if shouldTimeout { throw ShellTimeoutError() }
            return result
        }
    }

    // MARK: - Tests

    @Test func discoveryUsesConfiguredPathFirst() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: [
                "/custom/path/snaky",
                "/opt/homebrew/bin/snaky",
            ]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/custom/path/snaky" }
        )
        let path = await discovery.discover()
        #expect(path == "/custom/path/snaky")
    }

    @Test func discoveryConfiguredPathInvalidFallsThrough() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/opt/homebrew/bin/snaky"]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { "/nonexistent/snaky" }
        )
        let path = await discovery.discover()
        #expect(path == "/opt/homebrew/bin/snaky")
    }

    @Test func discoveryWellKnownPaths() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/opt/homebrew/bin/snaky"]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { nil }
        )
        let path = await discovery.discover()
        #expect(path == "/opt/homebrew/bin/snaky")
    }

    @Test func discoveryWellKnownOrder() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: [
                "/opt/homebrew/bin/snaky",
                "/usr/local/bin/snaky",
            ]),
            shellExecutor: MockShellExecutor(),
            configuredPath: { nil }
        )
        let path = await discovery.discover()
        #expect(path == "/opt/homebrew/bin/snaky")
    }

    @Test func discoveryLoginShellFallback() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: ["/home/user/.nvm/bin/snaky"]),
            shellExecutor: MockShellExecutor(result: "/home/user/.nvm/bin/snaky"),
            configuredPath: { nil }
        )
        let path = await discovery.discover()
        #expect(path == "/home/user/.nvm/bin/snaky")
    }

    @Test func discoveryLoginShellTimeout() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: []),
            shellExecutor: MockShellExecutor(shouldTimeout: true),
            configuredPath: { nil }
        )
        let path = await discovery.discover()
        #expect(path == nil)
    }

    @Test func discoveryNotFound() async {
        let discovery = CLIDiscovery(
            fileChecker: MockFileChecker(existingPaths: []),
            shellExecutor: MockShellExecutor(result: nil),
            configuredPath: { nil }
        )
        let path = await discovery.discover()
        #expect(path == nil)
    }
}
