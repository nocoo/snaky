import SwiftUI

public enum LatencyColor: Sendable {
    case green
    case yellow
    case red
    case none

    public var color: Color {
        switch self {
        case .green: Color(red: 0.30, green: 0.85, blue: 0.45)
        case .yellow: Color(red: 0.95, green: 0.75, blue: 0.25)
        case .red: Color(red: 0.95, green: 0.35, blue: 0.35)
        case .none: Color.white.opacity(0.4)
        }
    }

    public static func from(ms: Double?) -> LatencyColor {
        guard let ms else { return .none }
        if ms <= 200 { return .green }
        if ms <= 1000 { return .yellow }
        return .red
    }
}

public struct ProbeRowModel: Equatable, Sendable {
    public let name: String
    public let target: String
    public let ip: String
    public let location: String
    public let colo: String
    public let latencyText: String
    public let latencyColor: LatencyColor
    public let isSuccess: Bool
    public let errorCode: String?
    public let usedFallback: Bool
    public let resolvedTarget: String?

    public init(from entry: ProbeEntry) {
        name = entry.name
        target = entry.target
        ip = entry.ip ?? "—"
        location = entry.location ?? "—"
        colo = entry.colo ?? "—"
        isSuccess = entry.ok
        errorCode = entry.error?.code.rawValue
        usedFallback = entry.usedFallback
        resolvedTarget = entry.resolvedTarget
        latencyColor = LatencyColor.from(ms: entry.responseTimeMs)
        if let ms = entry.responseTimeMs {
            latencyText = "\(Int(ms))ms"
        } else {
            latencyText = "—"
        }
    }
}

public struct PingRoundDot: Equatable, Sendable {
    public let isSuccess: Bool
    public let ms: Double
}

public struct PingRowModel: Equatable, Sendable {
    public let name: String
    public let tag: String
    public let medianText: String
    public let latencyColor: LatencyColor
    public let isSuccess: Bool
    public let dots: [PingRoundDot]
    public let errorCode: String?

    public init(from result: PingResult) {
        name = result.name
        tag = result.tag
        isSuccess = result.ok
        errorCode = result.error?.code.rawValue
        latencyColor = LatencyColor.from(ms: result.medianMs)
        dots = result.rounds.map { PingRoundDot(isSuccess: $0 >= 0, ms: $0) }
        if let ms = result.medianMs {
            medianText = "\(Int(ms))ms"
        } else {
            medianText = "—"
        }
    }
}
