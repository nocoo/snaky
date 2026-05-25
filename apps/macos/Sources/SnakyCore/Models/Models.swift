import Foundation

public enum RunMode: String, Decodable, Sendable {
    case all
    case probe
    case ping
}

public struct FullOutput: Decodable, Sendable, Equatable {
    public let mode: RunMode
    public let probe: ProbeOutput?
    public let ping: PingOutput?
}

public struct ProbeOutput: Decodable, Sendable, Equatable {
    public let results: [ProbeEntry]
    public let summary: ProbeSummary
    public let uniqueIps: [UniqueIp]
}

public struct ProbeSummary: Decodable, Sendable, Equatable {
    public let total: Int
    public let succeeded: Int
    public let failed: Int
}

public struct UniqueIp: Decodable, Sendable, Equatable {
    public let ip: String
    public let location: String?
    public let count: Int
}

public struct ProbeEntry: Decodable, Sendable, Equatable {
    public let name: String
    public let category: String
    public let method: ProbeMethod
    public let target: String
    public let resolvedTarget: String?
    public let ok: Bool
    public let ip: String?
    public let location: String?
    public let colo: String?
    public let responseTimeMs: Double?
    public let usedFallback: Bool
    public let error: ProbeError?
}

public enum ProbeMethod: String, Decodable, Sendable {
    case cftrace
    case httpHeader = "http-header"
}

public struct ProbeError: Decodable, Sendable, Equatable {
    public let code: ErrorCode
    public let message: String
}

public enum ErrorCode: String, Decodable, Sendable {
    case timeout = "TIMEOUT"
    case dnsFailed = "DNS_FAILED"
    case connectionRefused = "CONNECTION_REFUSED"
    case tlsError = "TLS_ERROR"
    case httpError = "HTTP_ERROR"
    case parseError = "PARSE_ERROR"
    case redirect = "REDIRECT"
    case headerMissing = "HEADER_MISSING"
    case allFailed = "ALL_FAILED"
    case unknown = "UNKNOWN"
}

public struct PingOutput: Decodable, Sendable, Equatable {
    public let results: [PingResult]
}

public struct PingResult: Decodable, Sendable, Equatable {
    public let name: String
    public let tag: String
    public let ok: Bool
    public let medianMs: Double?
    public let rounds: [Double]
    public let error: ProbeError?
}
