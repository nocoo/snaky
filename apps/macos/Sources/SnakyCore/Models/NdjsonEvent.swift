import Foundation

public enum NdjsonEvent: Sendable, Equatable {
    case meta(mode: String, version: String, splitCount: Int?, connectCount: Int?, hasDns: Bool)
    case probeResult(index: Int, entry: ProbeEntry)
    case pingResult(index: Int, result: PingResult)
    case dnsProgress(message: String)
    case dnsUpdate(DnsLeakOutput)
    case ipDetail(IpDetail)
    case uniqueIp(UniqueIp)
    case summary(FullOutput)
    case errorEvent(code: String, message: String)
    case done(exitCode: Int32)
    case unknown(String)
}

private struct EventEnvelope: Decodable {
    let event: String
}

private struct MetaCounts: Decodable {
    let split: Int?
    let connect: Int?
    let dns: Bool?
}

private struct MetaData: Decodable {
    let mode: String
    let version: String
    let counts: MetaCounts
}

private struct MetaPayload: Decodable {
    let data: MetaData
}

private struct DnsProgressData: Decodable {
    let message: String
}

private struct DnsProgressPayload: Decodable {
    let data: DnsProgressData
}

private struct DnsUpdatePayload: Decodable {
    let data: DnsLeakOutput
}

private struct IpDetailPayload: Decodable {
    let data: IpDetail
}

private struct UniqueIpPayload: Decodable {
    let data: UniqueIp
}

private struct SummaryPayload: Decodable {
    let data: FullOutput
}

private struct ErrorData: Decodable {
    let code: String
    let message: String
}

private struct ErrorPayload: Decodable {
    let data: ErrorData
}

private struct DoneData: Decodable {
    let exitCode: Int32
}

private struct DonePayload: Decodable {
    let data: DoneData
}

private struct IndexHolder: Decodable {
    let index: Int
}

public struct NdjsonDecoder: Sendable {
    private let jsonDecoder: JSONDecoder

    public init() {
        self.jsonDecoder = JSONDecoder()
    }

    // swiftlint:disable:next cyclomatic_complexity
    public func decode(line: String) throws -> NdjsonEvent {
        guard let data = line.data(using: .utf8) else {
            throw CLIError.decodingFailed("non-utf8 line")
        }
        let envelope = try jsonDecoder.decode(EventEnvelope.self, from: data)
        switch envelope.event {
        case "meta":
            return try decodeMeta(data: data)
        case "probe.result":
            return try decodeProbeResult(data: data)
        case "ping.result":
            return try decodePingResult(data: data)
        case "dns.progress":
            let payload = try jsonDecoder.decode(DnsProgressPayload.self, from: data)
            return .dnsProgress(message: payload.data.message)
        case "dns.update":
            let payload = try jsonDecoder.decode(DnsUpdatePayload.self, from: data)
            return .dnsUpdate(payload.data)
        case "ip.detail":
            let payload = try jsonDecoder.decode(IpDetailPayload.self, from: data)
            return .ipDetail(payload.data)
        case "unique.ip":
            let payload = try jsonDecoder.decode(UniqueIpPayload.self, from: data)
            return .uniqueIp(payload.data)
        case "summary":
            let payload = try jsonDecoder.decode(SummaryPayload.self, from: data)
            return .summary(payload.data)
        case "error":
            let payload = try jsonDecoder.decode(ErrorPayload.self, from: data)
            return .errorEvent(code: payload.data.code, message: payload.data.message)
        case "done":
            let payload = try jsonDecoder.decode(DonePayload.self, from: data)
            return .done(exitCode: payload.data.exitCode)
        default:
            return .unknown(envelope.event)
        }
    }

    private func decodeMeta(data: Data) throws -> NdjsonEvent {
        let meta = try jsonDecoder.decode(MetaPayload.self, from: data)
        return .meta(
            mode: meta.data.mode,
            version: meta.data.version,
            splitCount: meta.data.counts.split,
            connectCount: meta.data.counts.connect,
            hasDns: meta.data.counts.dns ?? false
        )
    }

    private func decodeProbeResult(data: Data) throws -> NdjsonEvent {
        let dataField = try Self.extractDataField(from: data)
        let entry = try jsonDecoder.decode(ProbeEntry.self, from: dataField)
        let indexHolder = try jsonDecoder.decode(IndexHolder.self, from: dataField)
        return .probeResult(index: indexHolder.index, entry: entry)
    }

    private func decodePingResult(data: Data) throws -> NdjsonEvent {
        let dataField = try Self.extractDataField(from: data)
        let result = try jsonDecoder.decode(PingResult.self, from: dataField)
        let indexHolder = try jsonDecoder.decode(IndexHolder.self, from: dataField)
        return .pingResult(index: indexHolder.index, result: result)
    }

    private static func extractDataField(from data: Data) throws -> Data {
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let dataObj = json["data"] else {
            throw CLIError.decodingFailed("missing data field")
        }
        return try JSONSerialization.data(withJSONObject: dataObj)
    }
}
