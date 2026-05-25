import Foundation

public enum CLIError: Error, Equatable, Sendable {
    case notFound
    case fatal(String)
    case crashed(Int32)
    case timeout
    case decodingFailed(String)
}

public protocol ProcessExecutor: Sendable {
    func run(
        executablePath: String,
        arguments: [String],
        timeout: Duration
    ) async throws -> ProcessOutput
}

public struct ProcessOutput: Sendable {
    public let exitCode: Int32
    public let stdout: Data
    public let stderr: Data

    public init(exitCode: Int32, stdout: Data, stderr: Data) {
        self.exitCode = exitCode
        self.stdout = stdout
        self.stderr = stderr
    }
}

public struct DefaultProcessExecutor: ProcessExecutor {
    public init() {}

    public func run(
        executablePath: String,
        arguments: [String],
        timeout: Duration
    ) async throws -> ProcessOutput {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executablePath)
        process.arguments = arguments

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        try process.run()

        return try await withTaskCancellationHandler {
            try await withThrowingTaskGroup(of: ProcessOutput?.self) { group in
                group.addTask {
                    process.waitUntilExit()
                    let out = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
                    let err = stderrPipe.fileHandleForReading.readDataToEndOfFile()
                    return ProcessOutput(exitCode: process.terminationStatus, stdout: out, stderr: err)
                }

                group.addTask {
                    try await Task.sleep(for: timeout)
                    Self.gracefulKill(process)
                    return nil
                }

                guard let result = try await group.next(),
                      let output = result else {
                    group.cancelAll()
                    throw CLIError.timeout
                }
                group.cancelAll()
                return output
            }
        } onCancel: {
            Self.gracefulKill(process)
        }
    }

    private static func gracefulKill(_ process: Process) {
        guard process.isRunning else { return }
        process.terminate()
        let pid = process.processIdentifier
        DispatchQueue.global().asyncAfter(deadline: .now() + 2) {
            if process.isRunning {
                kill(pid, SIGKILL)
            }
        }
    }
}

public struct CLIBridge: Sendable {
    private let discovery: CLIDiscovery
    private let executor: ProcessExecutor
    private let invocationTimeout: Duration

    public init(
        discovery: CLIDiscovery = CLIDiscovery(),
        executor: ProcessExecutor = DefaultProcessExecutor(),
        timeout: Duration = .seconds(90)
    ) {
        self.discovery = discovery
        self.executor = executor
        self.invocationTimeout = timeout
    }

    public func invoke() async throws -> FullOutput {
        guard let path = await discovery.discover() else {
            throw CLIError.notFound
        }
        return try await invoke(executablePath: path)
    }

    public func invoke(executablePath path: String) async throws -> FullOutput {
        let output: ProcessOutput
        do {
            output = try await executor.run(
                executablePath: path,
                arguments: ["--json"],
                timeout: invocationTimeout
            )
        } catch let error as CLIError {
            throw error
        } catch {
            throw CLIError.fatal("Failed to launch CLI: \(error.localizedDescription)")
        }

        switch output.exitCode {
        case 0, 1, 2:
            return try decodeOutput(output.stdout)
        case 3:
            let stderr = String(data: output.stderr, encoding: .utf8) ?? "Unknown error"
            throw CLIError.fatal(stderr.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            throw CLIError.crashed(output.exitCode)
        }
    }

    public func fetchVersion() async -> String? {
        guard let path = await discovery.discover() else { return nil }
        let output = try? await executor.run(
            executablePath: path,
            arguments: ["--version"],
            timeout: .seconds(5)
        )
        guard let output, output.exitCode == 0 else { return nil }
        return String(data: output.stdout, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func decodeOutput(_ data: Data) throws -> FullOutput {
        do {
            return try JSONDecoder().decode(FullOutput.self, from: data)
        } catch {
            throw CLIError.decodingFailed(error.localizedDescription)
        }
    }
}
