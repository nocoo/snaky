import Foundation

public protocol FileExistenceChecker: Sendable {
    func isExecutableFile(atPath path: String) -> Bool
}

public protocol ShellExecutor: Sendable {
    func execute(command: String, timeout: Duration) async throws -> String?
}

public struct DefaultFileChecker: FileExistenceChecker {
    public init() {}

    public func isExecutableFile(atPath path: String) -> Bool {
        FileManager.default.isExecutableFile(atPath: path)
    }
}

public struct DefaultShellExecutor: ShellExecutor {
    public init() {}

    public func execute(command: String, timeout: Duration) async throws -> String? {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        // -i (interactive) ensures ~/.zshrc is sourced so PATH-modifying setups
        // like nvm, asdf, mise, fnm, rtx are loaded. -l alone (login shell) only
        // reads .zprofile/.zshenv on macOS, where these tools rarely install.
        process.arguments = ["-i", "-l", "-c", command]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        try process.run()

        let result: String? = try await withThrowingTaskGroup(of: String?.self) { group in
            group.addTask {
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                return String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            }

            group.addTask {
                try await Task.sleep(for: timeout)
                if process.isRunning { process.terminate() }
                throw ShellTimeoutError()
            }

            let value = try await group.next() ?? nil // swiftlint:disable:this redundant_nil_coalescing
            group.cancelAll()
            return value
        }

        process.waitUntilExit()
        guard process.terminationStatus == 0 else { return nil }
        return result
    }
}

struct ShellTimeoutError: Error {}

public struct CLIDiscovery: Sendable {
    private let fileChecker: FileExistenceChecker
    private let shellExecutor: ShellExecutor
    private let configuredPath: @Sendable () -> String?

    public static let wellKnownPaths: [String] = [
        "/opt/homebrew/bin/snaky",
        "/usr/local/bin/snaky",
        NSHomeDirectory() + "/.local/bin/snaky",
    ]

    public init(
        fileChecker: FileExistenceChecker = DefaultFileChecker(),
        shellExecutor: ShellExecutor = DefaultShellExecutor(),
        configuredPath: @escaping @Sendable () -> String? = { UserDefaults.standard.string(forKey: "cliPath") }
    ) {
        self.fileChecker = fileChecker
        self.shellExecutor = shellExecutor
        self.configuredPath = configuredPath
    }

    public func discover() async -> String? {
        if let configured = configuredPath() {
            if fileChecker.isExecutableFile(atPath: configured) {
                NSLog("[Snaky] CLI discovery: configured path %@", configured)
                return configured
            }
        }

        for path in Self.wellKnownPaths where fileChecker.isExecutableFile(atPath: path) {
            NSLog("[Snaky] CLI discovery: well-known path %@", path)
            return path
        }

        if let shellPath = try? await shellExecutor.execute(
            command: "which snaky",
            timeout: .seconds(3)
        ), !shellPath.isEmpty, fileChecker.isExecutableFile(atPath: shellPath) {
            NSLog("[Snaky] CLI discovery: shell which %@", shellPath)
            return shellPath
        }

        NSLog("[Snaky] CLI discovery FAILED — well-known paths missed and 'zsh -i -l -c which snaky' returned nothing")
        return nil
    }
}
