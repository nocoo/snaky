import Foundation

public enum RunMode: String, Codable, Sendable {
    case all
    case connect
    case split
    case dns
}

public struct FullOutput: Codable, Sendable, Equatable {
    public let mode: RunMode
    public let split: ProbeOutput?
    public let connect: PingOutput?
    public let dns: DnsLeakOutput?
    public let ipDetails: [IpDetail]?
}

public struct ProbeOutput: Codable, Sendable, Equatable {
    public let results: [ProbeEntry]
    public let summary: ProbeSummary
    public let uniqueIps: [UniqueIp]
}

public struct ProbeSummary: Codable, Sendable, Equatable {
    public let total: Int
    public let succeeded: Int
    public let failed: Int
}

public struct UniqueIp: Codable, Sendable, Equatable {
    public let ip: String
    public let location: String?
    public let count: Int
    public let detail: IpDetail?
}

public struct IpDetail: Codable, Sendable, Equatable {
    public let ip: String
    public let country: String?
    public let countryCode: String?
    public let province: String?
    public let city: String?
    public let isp: String?
    public let asn: Int?
    public let asOrg: String?
}

public struct ProbeEntry: Codable, Sendable, Equatable {
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

public enum ProbeMethod: String, Codable, Sendable {
    case cftrace
    case httpHeader = "http-header"
}

public struct ProbeError: Codable, Sendable, Equatable {
    public let code: ErrorCode
    public let message: String
}

public enum ErrorCode: String, Codable, Sendable {
    case timeout = "TIMEOUT"
    case dnsFailed = "DNS_FAILED"
    case connectionRefused = "CONNECTION_REFUSED"
    case connectionFailed = "CONNECTION_FAILED"
    case tlsError = "TLS_ERROR"
    case httpError = "HTTP_ERROR"
    case parseError = "PARSE_ERROR"
    case redirect = "REDIRECT"
    case headerMissing = "HEADER_MISSING"
    case allFailed = "ALL_FAILED"
    case unknown = "UNKNOWN"
}

public struct PingOutput: Codable, Sendable, Equatable {
    public let results: [PingResult]
}

public struct PingResult: Codable, Sendable, Equatable {
    public let name: String
    public let tag: String
    public let ok: Bool
    public let medianMs: Double?
    public let rounds: [Double]
    public let error: ProbeError?
}

// MARK: - DNS Leak Detection

public enum DnsLeakVerdict: String, Codable, Sendable, Equatable {
    case noLeak = "no_leak"
    case leak
    case inconclusive
}

public struct DnsServer: Codable, Sendable, Equatable {
    public let ip: String
    public let country: String?
    public let countryCode: String?
    public let city: String?
    public let isp: String?
    public let asn: Int?
    public let asOrg: String?
    public let leaked: Bool
}

public struct DnsLeakOutput: Codable, Sendable, Equatable {
    public let token: String
    public let rounds: Int
    public let userIp: String?
    public let userCountry: String?
    public let userCountryCode: String?
    public let dnsServers: [DnsServer]
    public let count: Int
    public let verdict: DnsLeakVerdict
}
