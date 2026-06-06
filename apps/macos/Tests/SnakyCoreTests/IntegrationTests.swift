import Foundation
import Testing

@testable import SnakyCore

struct IntegrationTests {
    private static func findSnaky() -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let paths = [
            "/opt/homebrew/bin/snaky",
            "/usr/local/bin/snaky",
            "\(home)/.local/bin/snaky",
        ]
        for path in paths where FileManager.default.fileExists(atPath: path) {
            return path
        }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-i", "-l", "-c", "which snaky"]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
            process.waitUntilExit()
            guard process.terminationStatus == 0 else { return nil }
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let result = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let result, !result.isEmpty, FileManager.default.fileExists(atPath: result) {
                return result
            }
        } catch {}
        return nil
    }

    private static let snakyAvailable: Bool = findSnaky() != nil

    @Test(.enabled(if: IntegrationTests.snakyAvailable, "snaky CLI not installed"))
    func realCLIJsonOutput() async throws {
        guard let path = Self.findSnaky() else { return }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["--json", "--timeout", "5000"]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        try process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        #expect(!data.isEmpty)

        let output = try JSONDecoder().decode(FullOutput.self, from: data)
        #expect(output.mode == .all)

        if let probe = output.split {
            #expect(probe.summary.total > 0)
            #expect(probe.results.count == probe.summary.total)
        }
    }

    @Test(.enabled(if: IntegrationTests.snakyAvailable, "snaky CLI not installed"))
    func realCLIVersion() async throws {
        guard let path = Self.findSnaky() else { return }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: path)
        process.arguments = ["--version"]

        let pipe = Pipe()
        process.standardOutput = pipe

        try process.run()
        process.waitUntilExit()

        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        let version = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        #expect(!version.isEmpty)

        let semverPattern = /^\d+\.\d+\.\d+$/
        #expect(version.contains(semverPattern))
    }

    @Test(.timeLimit(.minutes(3)), .enabled(if: IntegrationTests.snakyAvailable, "snaky CLI not installed"))
    func bridgeEndToEnd() async throws {
        let bridge = CLIBridge(timeout: .seconds(120))
        let output = try await bridge.invoke()
        #expect(output.mode == .all)
    }
}
