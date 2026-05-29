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

    func stream(
        executablePath: String,
        arguments: [String],
        timeout: Duration
    ) -> AsyncThrowingStream<StreamChunk, Error>
}

public enum StreamChunk: Sendable {
    case line(String)
    case stderr(String)
    case exit(Int32)
}

extension ProcessExecutor {
    public func stream(
        executablePath: String,
        arguments: [String],
        timeout: Duration
    ) -> AsyncThrowingStream<StreamChunk, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    let output = try await run(executablePath: executablePath, arguments: arguments, timeout: timeout)
                    if let str = String(data: output.stdout, encoding: .utf8) {
                        for line in str.split(separator: "\n", omittingEmptySubsequences: true) {
                            continuation.yield(.line(String(line)))
                        }
                    }
                    if let str = String(data: output.stderr, encoding: .utf8), !str.isEmpty {
                        continuation.yield(.stderr(str))
                    }
                    continuation.yield(.exit(output.exitCode))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
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

    // swiftlint:disable:next function_body_length
    public func stream(
        executablePath: String,
        arguments: [String],
        timeout: Duration
    ) -> AsyncThrowingStream<StreamChunk, Error> {
        AsyncThrowingStream { continuation in
            let process = Process()
            process.executableURL = URL(fileURLWithPath: executablePath)
            process.arguments = arguments

            let stdoutPipe = Pipe()
            let stderrPipe = Pipe()
            process.standardOutput = stdoutPipe
            process.standardError = stderrPipe

            let buffer = LineBuffer()
            stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if data.isEmpty { return }
                let lines = buffer.append(data)
                for line in lines {
                    continuation.yield(.line(line))
                }
            }
            stderrPipe.fileHandleForReading.readabilityHandler = { handle in
                let data = handle.availableData
                if data.isEmpty { return }
                if let str = String(data: data, encoding: .utf8) {
                    continuation.yield(.stderr(str))
                }
            }

            process.terminationHandler = { proc in
                stdoutPipe.fileHandleForReading.readabilityHandler = nil
                stderrPipe.fileHandleForReading.readabilityHandler = nil
                let leftover = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
                if !leftover.isEmpty {
                    let lines = buffer.append(leftover)
                    for line in lines {
                        continuation.yield(.line(line))
                    }
                    if let tail = buffer.flush() {
                        continuation.yield(.line(tail))
                    }
                }
                continuation.yield(.exit(proc.terminationStatus))
                continuation.finish()
            }

            do {
                try process.run()
            } catch {
                continuation.finish(throwing: CLIError.fatal(error.localizedDescription))
                return
            }

            let timeoutTask = Task {
                try? await Task.sleep(for: timeout)
                if process.isRunning {
                    Self.gracefulKill(process)
                    continuation.finish(throwing: CLIError.timeout)
                }
            }

            continuation.onTermination = { _ in
                timeoutTask.cancel()
                Self.gracefulKill(process)
            }
        }
    }
}

private final class LineBuffer: @unchecked Sendable {
    private var pending: Data = Data()
    private let lock = NSLock()

    func append(_ data: Data) -> [String] {
        lock.lock(); defer { lock.unlock() }
        pending.append(data)
        var lines: [String] = []
        while let nlIndex = pending.firstIndex(of: 0x0A) {
            let lineData = pending.subdata(in: pending.startIndex..<nlIndex)
            pending.removeSubrange(pending.startIndex...nlIndex)
            if let str = String(data: lineData, encoding: .utf8), !str.isEmpty {
                lines.append(str)
            }
        }
        return lines
    }

    func flush() -> String? {
        lock.lock(); defer { lock.unlock() }
        guard !pending.isEmpty else { return nil }
        let str = String(data: pending, encoding: .utf8)
        pending.removeAll()
        return str?.isEmpty == false ? str : nil
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
        return try await invoke(executablePath: path, arguments: ["--json"])
    }

    public func invoke(mode: String, tier: Int? = nil) async throws -> FullOutput {
        guard let path = await discovery.discover() else {
            throw CLIError.notFound
        }
        var args = [mode]
        if let tier {
            args += ["--tier", String(tier)]
        }
        args.append("--json")
        return try await invoke(executablePath: path, arguments: args)
    }

    public func streamRun(mode: String, tier: Int? = nil) async throws -> AsyncThrowingStream<NdjsonEvent, Error> {
        guard let path = await discovery.discover() else {
            throw CLIError.notFound
        }
        var args: [String] = []
        if mode != "all" {
            args.append(mode)
        }
        if let tier {
            args += ["--tier", String(tier)]
        }
        args.append("--ndjson")
        return makeNdjsonStream(executablePath: path, arguments: args)
    }

    public func streamDnsLeak(extended: Bool = false) async throws -> AsyncThrowingStream<NdjsonEvent, Error> {
        guard let path = await discovery.discover() else {
            throw CLIError.notFound
        }
        var args = ["dns", "--ndjson"]
        if extended {
            args.append("--extended")
        }
        return makeNdjsonStream(executablePath: path, arguments: args)
    }

    // swiftlint:disable:next function_body_length
    private func makeNdjsonStream(
        executablePath: String,
        arguments: [String]
    ) -> AsyncThrowingStream<NdjsonEvent, Error> {
        let executor = self.executor
        let timeout = self.invocationTimeout
        let decoder = NdjsonDecoder()

        return AsyncThrowingStream { continuation in
            let task = Task {
                let chunkStream = executor.stream(
                    executablePath: executablePath,
                    arguments: arguments,
                    timeout: timeout
                )

                var stderrBuffer = ""
                var sawDone = false
                do {
                    for try await chunk in chunkStream {
                        switch chunk {
                        case .line(let line):
                            do {
                                let event = try decoder.decode(line: line)
                                if case .done = event { sawDone = true }
                                continuation.yield(event)
                            } catch {
                                continuation.yield(.unknown(line))
                            }
                        case .stderr(let str):
                            stderrBuffer += str
                        case .exit(let code):
                            if code == 3 && !sawDone {
                                let msg = stderrBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
                                let detail = msg.isEmpty ? "CLI exited with code 3" : msg
                                continuation.finish(throwing: CLIError.fatal(detail))
                                return
                            }
                            if code > 3 {
                                continuation.finish(throwing: CLIError.crashed(code))
                                return
                            }
                            continuation.finish()
                            return
                        }
                    }
                    continuation.finish()
                } catch {
                    if let cliError = error as? CLIError {
                        continuation.finish(throwing: cliError)
                    } else {
                        continuation.finish(throwing: CLIError.fatal(error.localizedDescription))
                    }
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func invoke(executablePath path: String, arguments args: [String]) async throws -> FullOutput {
        let output: ProcessOutput
        do {
            output = try await executor.run(
                executablePath: path,
                arguments: args,
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

    public func invokeDnsLeak(extended: Bool = false) async throws -> DnsLeakOutput {
        guard let path = await discovery.discover() else {
            throw CLIError.notFound
        }
        var args = ["dns", "--json"]
        if extended {
            args.append("--extended")
        }

        let output: ProcessOutput
        do {
            output = try await executor.run(
                executablePath: path,
                arguments: args,
                timeout: invocationTimeout
            )
        } catch let error as CLIError {
            throw error
        } catch {
            throw CLIError.fatal("Failed to launch CLI: \(error.localizedDescription)")
        }

        switch output.exitCode {
        case 0, 1, 2:
            return try decodeDnsLeakOutput(output.stdout)
        case 3:
            let stderr = String(data: output.stderr, encoding: .utf8) ?? "Unknown error"
            throw CLIError.fatal(stderr.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            throw CLIError.crashed(output.exitCode)
        }
    }

    private func decodeOutput(_ data: Data) throws -> FullOutput {
        do {
            return try JSONDecoder().decode(FullOutput.self, from: data)
        } catch {
            throw CLIError.decodingFailed(error.localizedDescription)
        }
    }

    private func decodeDnsLeakOutput(_ data: Data) throws -> DnsLeakOutput {
        do {
            return try JSONDecoder().decode(DnsLeakOutput.self, from: data)
        } catch {
            throw CLIError.decodingFailed(error.localizedDescription)
        }
    }
}
